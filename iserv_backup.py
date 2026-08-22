"""Encrypted IServ WebDAV storage for GSM worksheet snapshots."""

from __future__ import annotations

import base64
import binascii
import datetime as dt
import hashlib
import json
import os
import re
import secrets
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Mapping
from urllib.parse import quote, unquote, urlsplit

import requests
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


BACKUP_FORMAT = "gsm-interaktives-arbeitsblatt-iserv-backup"
BACKUP_SCHEMA_VERSION = 1
BACKUP_SUFFIX = ".iabackup"
MAGIC = b"GSMIABK1"
SALT_BYTES = 16
NONCE_BYTES = 12
MAX_BACKUP_BYTES = 25 * 1024 * 1024
MAX_ENCRYPTED_BYTES = MAX_BACKUP_BYTES + len(MAGIC) + SALT_BYTES + NONCE_BYTES + 16
REMOTE_NAME_RE = re.compile(
    r"^\d{8}T\d{6}Z_(?:(?P<app_marker>[a-f0-9]{12})_)?[a-f0-9]{12}\.iabackup$"
)

ENV_FIELDS = {
    "ISERV_WEBDAV_URL": "WebDAV-Adresse",
    "ISERV_WEBDAV_USERNAME": "Benutzername",
    "ISERV_WEBDAV_PASSWORD": "Passwort",
    "ISERV_BACKUP_PATH": "Zielordner",
    "ISERV_BACKUP_ENCRYPTION_KEY": "Verschlüsselungsschlüssel",
}


class IservBackupError(RuntimeError):
    """A safe, user-displayable IServ backup error."""


class IservConfigurationError(IservBackupError):
    pass


class IservConnectionError(IservBackupError):
    pass


class IservPayloadError(IservBackupError):
    pass


def utc_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def app_marker(app_id: str) -> str:
    """Stable, non-secret marker used to pre-filter one worksheet's files."""
    return hashlib.sha256(str(app_id).encode("utf-8")).hexdigest()[:12]


def _decode_master_key(value: str) -> bytes:
    try:
        padded = value.strip() + "=" * (-len(value.strip()) % 4)
        key = base64.urlsafe_b64decode(padded.encode("ascii"))
    except (ValueError, UnicodeEncodeError, binascii.Error) as exc:
        raise IservConfigurationError(
            "ISERV_BACKUP_ENCRYPTION_KEY ist kein gültiger Base64-Schlüssel."
        ) from exc
    if len(key) != 32:
        raise IservConfigurationError(
            "ISERV_BACKUP_ENCRYPTION_KEY muss genau 32 Byte enthalten."
        )
    return key


def _normalize_backup_path(value: str) -> str:
    raw = value.strip().replace("\\", "/")
    parts = [part for part in raw.split("/") if part]
    if not parts or any(part in {".", ".."} for part in parts):
        raise IservConfigurationError("ISERV_BACKUP_PATH ist ungültig.")
    if any("\x00" in part or "?" in part or "#" in part for part in parts):
        raise IservConfigurationError("ISERV_BACKUP_PATH enthält ungültige Zeichen.")
    return "/".join(parts)


def _validate_base_url(value: str) -> str:
    url = value.strip().rstrip("/")
    parsed = urlsplit(url)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        raise IservConfigurationError(
            "ISERV_WEBDAV_URL muss eine vollständige HTTPS-Adresse sein."
        )
    if parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise IservConfigurationError(
            "ISERV_WEBDAV_URL darf keine Zugangsdaten, Query oder Fragment enthalten."
        )
    return url


def configuration_status(environ: Mapping[str, str] | None = None) -> dict:
    source = os.environ if environ is None else environ
    missing = [name for name in ENV_FIELDS if not str(source.get(name, "")).strip()]
    result = {
        "configured": not missing,
        "missing": missing,
        "encryption": "AES-256-GCM",
    }
    if source.get("ISERV_WEBDAV_URL"):
        parsed = urlsplit(str(source["ISERV_WEBDAV_URL"]).strip())
        result["endpoint"] = parsed.hostname or ""
    if source.get("ISERV_BACKUP_PATH"):
        result["path"] = str(source["ISERV_BACKUP_PATH"]).strip()
    if not missing:
        try:
            IservConfig.from_env(source)
        except IservConfigurationError as exc:
            result["configured"] = False
            result["error"] = str(exc)
    return result


@dataclass(frozen=True)
class IservConfig:
    base_url: str
    username: str
    password: str
    backup_path: str
    master_key: bytes
    timeout_seconds: float = 15.0
    ca_bundle: str | bool = True

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "IservConfig":
        source = os.environ if environ is None else environ
        missing = [name for name in ENV_FIELDS if not str(source.get(name, "")).strip()]
        if missing:
            raise IservConfigurationError(
                "IServ ist noch nicht vollständig konfiguriert: " + ", ".join(missing)
            )
        try:
            timeout = float(str(source.get("ISERV_TIMEOUT_SECONDS", "15")).strip())
        except ValueError as exc:
            raise IservConfigurationError(
                "ISERV_TIMEOUT_SECONDS muss eine Zahl sein."
            ) from exc
        if not 2 <= timeout <= 60:
            raise IservConfigurationError(
                "ISERV_TIMEOUT_SECONDS muss zwischen 2 und 60 liegen."
            )
        ca_bundle_raw = str(source.get("ISERV_CA_BUNDLE", "")).strip()
        if ca_bundle_raw and not os.path.isfile(ca_bundle_raw):
            raise IservConfigurationError("ISERV_CA_BUNDLE wurde nicht gefunden.")
        return cls(
            base_url=_validate_base_url(str(source["ISERV_WEBDAV_URL"])),
            username=str(source["ISERV_WEBDAV_USERNAME"]).strip(),
            password=str(source["ISERV_WEBDAV_PASSWORD"]),
            backup_path=_normalize_backup_path(str(source["ISERV_BACKUP_PATH"])),
            master_key=_decode_master_key(
                str(source["ISERV_BACKUP_ENCRYPTION_KEY"])
            ),
            timeout_seconds=timeout,
            ca_bundle=ca_bundle_raw or True,
        )


def _derive_file_key(master_key: bytes, salt: bytes) -> bytes:
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"gsm-iserv-backup-v1",
    ).derive(master_key)


def encrypt_envelope(envelope: dict, master_key: bytes) -> bytes:
    plaintext = json.dumps(
        envelope, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    if len(plaintext) > MAX_BACKUP_BYTES:
        raise IservPayloadError("Die Unterrichtssitzung ist für den Export zu groß.")
    salt = secrets.token_bytes(SALT_BYTES)
    nonce = secrets.token_bytes(NONCE_BYTES)
    aad = MAGIC + salt
    ciphertext = AESGCM(_derive_file_key(master_key, salt)).encrypt(
        nonce, plaintext, aad
    )
    return MAGIC + salt + nonce + ciphertext


def decrypt_envelope(payload: bytes, master_key: bytes) -> dict:
    minimum = len(MAGIC) + SALT_BYTES + NONCE_BYTES + 16
    if not isinstance(payload, bytes) or len(payload) < minimum:
        raise IservPayloadError("Die IServ-Sicherungsdatei ist unvollständig.")
    if len(payload) > MAX_ENCRYPTED_BYTES:
        raise IservPayloadError("Die IServ-Sicherungsdatei ist zu groß.")
    if not payload.startswith(MAGIC):
        raise IservPayloadError("Die Datei ist keine gültige Arbeitsblatt-Sicherung.")
    offset = len(MAGIC)
    salt = payload[offset : offset + SALT_BYTES]
    offset += SALT_BYTES
    nonce = payload[offset : offset + NONCE_BYTES]
    offset += NONCE_BYTES
    ciphertext = payload[offset:]
    try:
        plaintext = AESGCM(_derive_file_key(master_key, salt)).decrypt(
            nonce, ciphertext, MAGIC + salt
        )
        envelope = json.loads(plaintext.decode("utf-8"))
    except (InvalidTag, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise IservPayloadError(
            "Die Sicherung ist beschädigt oder der Verschlüsselungsschlüssel passt nicht."
        ) from exc
    if not isinstance(envelope, dict):
        raise IservPayloadError("Der entschlüsselte Sicherungsinhalt ist ungültig.")
    return envelope


def validate_remote_name(name: str) -> str:
    candidate = str(name).strip()
    if not REMOTE_NAME_RE.fullmatch(candidate):
        raise IservPayloadError("Der Name der IServ-Sicherung ist ungültig.")
    return candidate


class IservBackupService:
    def __init__(self, config: IservConfig, session: requests.Session | None = None):
        self.config = config
        self.session = session or requests.Session()

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
        session: requests.Session | None = None,
    ) -> "IservBackupService":
        return cls(IservConfig.from_env(environ), session=session)

    def _folder_url(self) -> str:
        encoded = "/".join(
            quote(part, safe="") for part in self.config.backup_path.split("/")
        )
        return f"{self.config.base_url}/{encoded}/"

    def _file_url(self, remote_name: str) -> str:
        safe_name = validate_remote_name(remote_name)
        return self._folder_url() + quote(safe_name, safe="")

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        try:
            response = self.session.request(
                method,
                url,
                auth=(self.config.username, self.config.password),
                timeout=self.config.timeout_seconds,
                verify=self.config.ca_bundle,
                **kwargs,
            )
        except requests.RequestException as exc:
            raise IservConnectionError(
                "IServ ist derzeit nicht erreichbar. Die lokale Sicherung bleibt erhalten."
            ) from exc
        if response.status_code == 401:
            raise IservConnectionError(
                "IServ hat die Anmeldung abgelehnt. Bitte Zugangsdaten prüfen."
            )
        if response.status_code == 403:
            raise IservConnectionError(
                "Der IServ-Account hat für den Zielordner keine ausreichenden Rechte."
            )
        if response.status_code == 404:
            raise IservConnectionError(
                "Der konfigurierte IServ-Zielordner wurde nicht gefunden."
            )
        return response

    @staticmethod
    def _propfind_body() -> bytes:
        return b"""<?xml version=\"1.0\" encoding=\"utf-8\"?>
<d:propfind xmlns:d=\"DAV:\"><d:prop><d:displayname/><d:getlastmodified/><d:getcontentlength/></d:prop></d:propfind>"""

    def test_connection(self) -> dict:
        response = self._request(
            "PROPFIND",
            self._folder_url(),
            headers={"Depth": "0", "Content-Type": "application/xml; charset=utf-8"},
            data=self._propfind_body(),
        )
        if response.status_code not in {200, 207}:
            raise IservConnectionError(
                f"IServ antwortet unerwartet (HTTP {response.status_code})."
            )
        return {"ok": True, "endpoint": urlsplit(self.config.base_url).hostname}

    def upload_snapshot(self, name: str, app_id: str, snapshot: dict) -> dict:
        timestamp = utc_iso()
        envelope = {
            "format": BACKUP_FORMAT,
            "schema_version": BACKUP_SCHEMA_VERSION,
            "app_id": app_id,
            "name": str(name).strip()[:80] or "Unterrichtssitzung",
            "created_at": timestamp,
            "snapshot": snapshot,
        }
        encrypted = encrypt_envelope(envelope, self.config.master_key)
        filename = (
            dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            + f"_{app_marker(app_id)}_{secrets.token_hex(6)}{BACKUP_SUFFIX}"
        )
        response = self._request(
            "PUT",
            self._file_url(filename),
            headers={
                "Content-Type": "application/octet-stream",
                "If-None-Match": "*",
            },
            data=encrypted,
        )
        if response.status_code not in {200, 201, 204}:
            raise IservConnectionError(
                f"IServ konnte die Sicherung nicht speichern (HTTP {response.status_code})."
            )
        return {
            "filename": filename,
            "name": envelope["name"],
            "created_at": timestamp,
            "size": len(encrypted),
        }

    def list_backups(self) -> list[dict]:
        response = self._request(
            "PROPFIND",
            self._folder_url(),
            headers={"Depth": "1", "Content-Type": "application/xml; charset=utf-8"},
            data=self._propfind_body(),
        )
        if response.status_code not in {200, 207}:
            raise IservConnectionError(
                f"IServ konnte den Sicherungsordner nicht lesen (HTTP {response.status_code})."
            )
        try:
            root = ET.fromstring(response.content)
        except ET.ParseError as exc:
            raise IservConnectionError(
                "IServ hat eine ungültige WebDAV-Antwort geliefert."
            ) from exc
        items = []
        namespace = {"d": "DAV:"}
        for node in root.findall("d:response", namespace):
            href = node.findtext("d:href", default="", namespaces=namespace)
            filename = PurePosixPath(unquote(urlsplit(href).path).rstrip("/")).name
            if not REMOTE_NAME_RE.fullmatch(filename):
                continue
            prop = node.find("d:propstat/d:prop", namespace)
            modified = ""
            size = 0
            if prop is not None:
                modified = prop.findtext(
                    "d:getlastmodified", default="", namespaces=namespace
                )
                raw_size = prop.findtext(
                    "d:getcontentlength", default="0", namespaces=namespace
                )
                try:
                    size = int(raw_size)
                except ValueError:
                    size = 0
            items.append({"filename": filename, "modified": modified, "size": size})
        return sorted(items, key=lambda item: item["filename"], reverse=True)

    def list_backup_summaries(self, expected_app_id: str) -> list[dict]:
        """List only decryptable backups belonging to one worksheet.

        New filenames carry a short app marker, allowing unrelated worksheet
        files to be skipped before download. Legacy files without a marker are
        still inspected so already-created backups remain visible.
        """
        expected_marker = app_marker(expected_app_id)
        summaries = []
        for item in self.list_backups():
            match = REMOTE_NAME_RE.fullmatch(item["filename"])
            marker = match.group("app_marker") if match else None
            if marker and marker != expected_marker:
                continue
            try:
                envelope = self.download_snapshot(item["filename"], expected_app_id)
            except IservPayloadError:
                # Another legacy worksheet, another key, or a damaged file must
                # not pollute this worksheet's dashboard overview.
                continue
            summaries.append(
                {
                    **item,
                    "name": str(envelope.get("name", "Unterrichtssitzung"))[:80],
                    "created_at": str(envelope.get("created_at", "")),
                    "app_marker": expected_marker,
                }
            )
        return summaries

    def download_snapshot(self, remote_name: str, expected_app_id: str) -> dict:
        response = self._request("GET", self._file_url(remote_name))
        if response.status_code != 200:
            raise IservConnectionError(
                f"IServ konnte die Sicherung nicht laden (HTTP {response.status_code})."
            )
        length_header = response.headers.get("Content-Length", "")
        if length_header.isdigit() and int(length_header) > MAX_ENCRYPTED_BYTES:
            raise IservPayloadError("Die IServ-Sicherungsdatei ist zu groß.")
        envelope = decrypt_envelope(response.content, self.config.master_key)
        if envelope.get("format") != BACKUP_FORMAT:
            raise IservPayloadError("Das Sicherungsformat wird nicht unterstützt.")
        if envelope.get("schema_version") != BACKUP_SCHEMA_VERSION:
            raise IservPayloadError("Die Sicherung verwendet eine andere Formatversion.")
        if envelope.get("app_id") != expected_app_id:
            raise IservPayloadError(
                "Die Sicherung gehört zu einem anderen interaktiven Arbeitsblatt."
            )
        if not isinstance(envelope.get("snapshot"), dict):
            raise IservPayloadError("Die Sicherung enthält keinen gültigen Snapshot.")
        return envelope
