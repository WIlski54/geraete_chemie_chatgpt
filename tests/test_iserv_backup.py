import base64
import secrets
import unittest

import iserv_backup as backup


class FakeResponse:
    def __init__(self, status_code=200, content=b"", headers=None):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}


class FakeSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if not self.responses:
            raise AssertionError("Keine simulierte WebDAV-Antwort vorhanden.")
        return self.responses.pop(0)


def valid_environment():
    return {
        "ISERV_WEBDAV_URL": "https://webdav.gsm-w.de",
        "ISERV_WEBDAV_USERNAME": "prototype.user",
        "ISERV_WEBDAV_PASSWORD": "test-password",
        "ISERV_BACKUP_PATH": "Files/Backups_AB_KI",
        "ISERV_BACKUP_ENCRYPTION_KEY": base64.urlsafe_b64encode(
            secrets.token_bytes(32)
        ).decode(),
        "ISERV_TIMEOUT_SECONDS": "10",
    }


class IservEncryptionTest(unittest.TestCase):
    def test_authenticated_encryption_round_trip_and_tamper_detection(self):
        key = secrets.token_bytes(32)
        envelope = {
            "format": backup.BACKUP_FORMAT,
            "schema_version": 1,
            "app_id": "chemie-test",
            "name": "7a Stunde 1",
            "snapshot": {"schueler": [{"pseudonym": "Neonfuchs"}]},
        }
        encrypted = backup.encrypt_envelope(envelope, key)
        self.assertNotIn(b"Neonfuchs", encrypted)
        self.assertEqual(backup.decrypt_envelope(encrypted, key), envelope)

        tampered = encrypted[:-1] + bytes([encrypted[-1] ^ 1])
        with self.assertRaises(backup.IservPayloadError):
            backup.decrypt_envelope(tampered, key)
        with self.assertRaises(backup.IservPayloadError):
            backup.decrypt_envelope(encrypted, secrets.token_bytes(32))

    def test_configuration_requires_https_and_safe_path(self):
        environment = valid_environment()
        config = backup.IservConfig.from_env(environment)
        self.assertEqual(config.backup_path, "Files/Backups_AB_KI")
        self.assertTrue(backup.configuration_status(environment)["configured"])

        environment["ISERV_WEBDAV_URL"] = "http://webdav.gsm-w.de"
        with self.assertRaises(backup.IservConfigurationError):
            backup.IservConfig.from_env(environment)

        environment = valid_environment()
        environment["ISERV_BACKUP_PATH"] = "Files/../Eigene"
        with self.assertRaises(backup.IservConfigurationError):
            backup.IservConfig.from_env(environment)


class IservWebDavTest(unittest.TestCase):
    def test_upload_uses_encrypted_put_and_does_not_overwrite(self):
        fake = FakeSession(FakeResponse(201))
        service = backup.IservBackupService.from_env(valid_environment(), session=fake)
        result = service.upload_snapshot(
            "7a Stunde 1",
            "chemie-test",
            {"schueler": [{"pseudonym": "Neonfuchs"}]},
        )
        method, url, kwargs = fake.calls[0]
        self.assertEqual(method, "PUT")
        self.assertIn("/Files/Backups_AB_KI/", url)
        self.assertEqual(kwargs["headers"]["If-None-Match"], "*")
        self.assertNotIn(b"Neonfuchs", kwargs["data"])
        decoded = backup.decrypt_envelope(kwargs["data"], service.config.master_key)
        self.assertEqual(decoded["name"], "7a Stunde 1")
        self.assertTrue(result["filename"].endswith(backup.BACKUP_SUFFIX))
        self.assertIn(backup.app_marker("chemie-test"), result["filename"])

    def test_list_and_download_validate_remote_files(self):
        filename = "20260821T120000Z_abcdef123456.iabackup"
        xml = f"""<?xml version="1.0"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:href>/Files/Backups_AB_KI/</d:href></d:response>
          <d:response><d:href>/Files/Backups_AB_KI/{filename}</d:href>
            <d:propstat><d:prop><d:getlastmodified>Fri, 21 Aug 2026 12:00:00 GMT</d:getlastmodified><d:getcontentlength>512</d:getcontentlength></d:prop></d:propstat>
          </d:response>
          <d:response><d:href>/Files/Backups_AB_KI/Notizen.txt</d:href></d:response>
        </d:multistatus>""".encode()
        environment = valid_environment()
        config = backup.IservConfig.from_env(environment)
        envelope = {
            "format": backup.BACKUP_FORMAT,
            "schema_version": backup.BACKUP_SCHEMA_VERSION,
            "app_id": "chemie-test",
            "name": "7a Stunde 1",
            "created_at": "2026-08-21T12:00:00Z",
            "snapshot": {"schueler": []},
        }
        encrypted = backup.encrypt_envelope(envelope, config.master_key)
        fake = FakeSession(
            FakeResponse(207, xml),
            FakeResponse(200, encrypted, {"Content-Length": str(len(encrypted))}),
        )
        service = backup.IservBackupService(config, session=fake)

        listed = service.list_backups()
        self.assertEqual([item["filename"] for item in listed], [filename])
        loaded = service.download_snapshot(filename, "chemie-test")
        self.assertEqual(loaded["name"], "7a Stunde 1")

        with self.assertRaises(backup.IservPayloadError):
            service.download_snapshot("../fremde-datei", "chemie-test")

    def test_scoped_overview_shows_names_and_filters_other_worksheets(self):
        expected_app = "chemie-laborgeraete-jg7-v1"
        foreign_app = "chemie-redox-jg9-v1"
        matching = (
            f"20260823T120000Z_{backup.app_marker(expected_app)}_aaaabbbbcccc.iabackup"
        )
        foreign = (
            f"20260822T120000Z_{backup.app_marker(foreign_app)}_ddddeeeeffff.iabackup"
        )
        legacy = "20260821T120000Z_abcdef123456.iabackup"
        xml = f"""<?xml version="1.0"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:href>/Files/Backups_AB_KI/{matching}</d:href>
            <d:propstat><d:prop><d:getcontentlength>500</d:getcontentlength></d:prop></d:propstat>
          </d:response>
          <d:response><d:href>/Files/Backups_AB_KI/{foreign}</d:href>
            <d:propstat><d:prop><d:getcontentlength>600</d:getcontentlength></d:prop></d:propstat>
          </d:response>
          <d:response><d:href>/Files/Backups_AB_KI/{legacy}</d:href>
            <d:propstat><d:prop><d:getcontentlength>400</d:getcontentlength></d:prop></d:propstat>
          </d:response>
        </d:multistatus>""".encode()
        config = backup.IservConfig.from_env(valid_environment())

        def encrypted(name, created_at):
            return backup.encrypt_envelope(
                {
                    "format": backup.BACKUP_FORMAT,
                    "schema_version": backup.BACKUP_SCHEMA_VERSION,
                    "app_id": expected_app,
                    "name": name,
                    "created_at": created_at,
                    "snapshot": {"schueler": []},
                },
                config.master_key,
            )

        current_payload = encrypted("7a · Laborgeräte · komplett", "2026-08-23T12:00:00Z")
        legacy_payload = encrypted("7a · erster Test", "2026-08-21T12:00:00Z")
        fake = FakeSession(
            FakeResponse(207, xml),
            FakeResponse(200, current_payload),
            FakeResponse(200, legacy_payload),
        )
        service = backup.IservBackupService(config, session=fake)

        summaries = service.list_backup_summaries(expected_app)

        self.assertEqual(
            [item["name"] for item in summaries],
            ["7a · Laborgeräte · komplett", "7a · erster Test"],
        )
        requested_urls = [url for _method, url, _kwargs in fake.calls]
        self.assertFalse(any(foreign in url for url in requested_urls))


if __name__ == "__main__":
    unittest.main()
