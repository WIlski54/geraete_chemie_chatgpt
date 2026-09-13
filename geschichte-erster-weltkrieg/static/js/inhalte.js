// Inhalte des interaktiven Arbeitsblatts „Der Erste Weltkrieg (1914–1918)“
// Geschichte · Klasse 9 · Gesamtschule Meiderich
// Aufgabennummern müssen zu ABSCHNITTE in app.py passen.

window.INHALTE = {
  titel: "Der Erste Weltkrieg (1914–1918)",

  // ─── Kartendaten (Längengrad/Breitengrad, vereinfachte Kartenskizze) ───
  karten: {
    europa1914: {
      titel: "Europa 1914 – zwei Blöcke",
      legende: [["mm", "Mittelmächte / Dreibund"], ["en", "Entente"], ["neutral", "neutral"]],
      linien: [
        ["berlin", "wien", "mm"], ["berlin", "rom", "mm"], ["wien", "rom", "mm"],
        ["paris", "petersburg", "en"], ["paris", "london", "en"], ["london", "petersburg", "en"],
      ],
      punkte: [
        { id: "berlin", lon: 13.4, lat: 52.5, label: "Deutsches Reich", bloc: "mm", icon: "🦅", titel: "Deutsches Reich (Berlin)", text: "Seit 1871 Kaiserreich, wirtschaftlich stark, aber als „verspätete Nation“ ohne große Kolonien. Wilhelm II. fordert einen „Platz an der Sonne“ und lässt eine Flotte bauen – Großbritannien fühlt sich bedroht. Zweibund mit Österreich-Ungarn (1879), Dreibund mit Italien (1882)." },
        { id: "wien", lon: 16.4, lat: 48.2, label: "Österreich-Ungarn", bloc: "mm", icon: "👑", titel: "Österreich-Ungarn (Wien)", text: "Vielvölkerstaat mit über zehn Nationalitäten. Der serbische Nationalismus bedroht den Zusammenhalt der Monarchie. 1908 annektiert Österreich-Ungarn Bosnien – mit der Hauptstadt Sarajevo." },
        { id: "rom", lon: 12.5, lat: 41.9, label: "Italien", bloc: "mm", icon: "🏛️", titel: "Italien (Rom)", text: "Mitglied des Dreibunds, bleibt 1914 aber neutral: Der Dreibund war ein Verteidigungsbündnis, und Italien hat eigene Ziele (Trentino, Triest – beide gehören zu Österreich-Ungarn). 1915 tritt Italien auf Seiten der Entente in den Krieg ein." },
        { id: "paris", lon: 2.35, lat: 48.85, label: "Frankreich", bloc: "en", icon: "🗼", titel: "Frankreich (Paris)", text: "Republik, seit der Niederlage 1871 auf Revanche bedacht: Elsass-Lothringen soll zurückgewonnen werden. Bündnis mit Russland (1894), Entente cordiale mit Großbritannien (1904). Großes Kolonialreich in Afrika und Asien." },
        { id: "london", lon: -0.1, lat: 51.5, label: "Großbritannien", bloc: "en", icon: "⚓", titel: "Großbritannien (London)", text: "Größte See- und Kolonialmacht der Welt. Das deutsche Flottenbauprogramm gilt als direkte Bedrohung. 1904 Entente cordiale mit Frankreich, 1907 Ausgleich mit Russland – daraus entsteht die Triple Entente." },
        { id: "petersburg", lon: 30.3, lat: 59.9, label: "Russland", bloc: "en", icon: "🐻", titel: "Russisches Reich (St. Petersburg)", text: "Riesiges Zarenreich mit vielen Bauern und einer schwachen Industrie. Versteht sich als Schutzmacht aller Slawen (Panslawismus) und unterstützt deshalb Serbien. Mit Frankreich seit 1894 verbündet." },
        { id: "belgrad", lon: 20.5, lat: 44.8, label: "Serbien", bloc: "en", icon: "🔥", titel: "Serbien (Belgrad)", text: "Kleines Königreich, nach den Balkankriegen 1912/13 stark vergrößert. Serbische Nationalisten wollen alle Südslawen in einem Staat vereinen – auch die in Österreich-Ungarn. Russland ist Serbiens Schutzmacht." },
        { id: "konstantinopel", lon: 29.0, lat: 41.0, label: "Osmanisches Reich", bloc: "mm", icon: "🌙", titel: "Osmanisches Reich (Konstantinopel)", text: "Der „kranke Mann am Bosporus“ verliert seit Jahrzehnten Gebiete auf dem Balkan. Dieses Machtvakuum macht den Balkan zum „Pulverfass“. Im November 1914 tritt das Reich auf Seiten der Mittelmächte in den Krieg ein." },
        { id: "bruessel", lon: 4.35, lat: 50.85, label: "Belgien", bloc: "neutral", icon: "🕊️", titel: "Belgien (Brüssel)", text: "Neutraler Staat, dessen Unabhängigkeit seit 1839 von den Großmächten garantiert wird. Der Schlieffen-Plan sieht vor, durch Belgien nach Frankreich vorzustoßen – der Bruch der Neutralität bringt 1914 Großbritannien in den Krieg." },
      ],
    },

    julikrise: {
      titel: "Die Julikrise 1914 – Orte der Entscheidung",
      legende: [["mm", "Mittelmächte"], ["en", "Entente"], ["neutral", "neutral"]],
      linien: [],
      punkte: [
        { id: "sarajevo", lon: 18.4, lat: 43.85, label: "1 Sarajevo", bloc: "mm", icon: "🎯", titel: "28. Juni 1914 – Sarajevo", text: "Der bosnisch-serbische Nationalist Gavrilo Princip erschießt den österreichisch-ungarischen Thronfolger Franz Ferdinand und seine Frau Sophie. Sarajevo gehört seit 1908 zu Österreich-Ungarn." },
        { id: "berlin", lon: 13.4, lat: 52.5, label: "2 Berlin", bloc: "mm", icon: "📜", titel: "5./6. Juli 1914 – Berlin", text: "Kaiser Wilhelm II. und Reichskanzler Bethmann Hollweg sichern Österreich-Ungarn uneingeschränkte Unterstützung zu – der „Blankoscheck“. Berlin erklärt außerdem am 1. August Russland und am 3. August Frankreich den Krieg." },
        { id: "wien", lon: 16.4, lat: 48.2, label: "3 Wien", bloc: "mm", icon: "⏳", titel: "23. und 28. Juli 1914 – Wien", text: "Österreich-Ungarn stellt Serbien ein 48-Stunden-Ultimatum mit fast unerfüllbaren Forderungen. Am 28. Juli erklärt es Serbien den Krieg – die erste Kriegserklärung des Ersten Weltkriegs." },
        { id: "belgrad", lon: 20.5, lat: 44.8, label: "4 Belgrad", bloc: "en", icon: "✉️", titel: "25. Juli 1914 – Belgrad", text: "Serbien nimmt fast alle Punkte des Ultimatums an, lehnt aber die Mitarbeit österreichischer Beamter an den Ermittlungen im eigenen Land ab. Wien bricht daraufhin die Beziehungen ab." },
        { id: "petersburg", lon: 30.3, lat: 59.9, label: "5 St. Petersburg", bloc: "en", icon: "🪖", titel: "30. Juli 1914 – St. Petersburg", text: "Zar Nikolaus II. ordnet die Generalmobilmachung an, um Serbien zu unterstützen. Für die deutsche Führung ist das der Grund, den Schlieffen-Plan in Gang zu setzen." },
        { id: "paris", lon: 2.35, lat: 48.85, label: "6 Paris", bloc: "en", icon: "🇫🇷", titel: "1.–3. August 1914 – Paris", text: "Frankreich macht am 1. August mobil. Deutschland erklärt Frankreich am 3. August den Krieg – obwohl der Konflikt auf dem Balkan begann." },
        { id: "bruessel", lon: 4.35, lat: 50.85, label: "7 Brüssel", bloc: "neutral", icon: "🚧", titel: "4. August 1914 – Brüssel", text: "Deutsche Truppen marschieren in das neutrale Belgien ein, um Frankreich von Norden anzugreifen (Schlieffen-Plan). Belgien leistet Widerstand." },
        { id: "london", lon: -0.1, lat: 51.5, label: "8 London", bloc: "en", icon: "🇬🇧", titel: "4. August 1914 – London", text: "Wegen der Verletzung der belgischen Neutralität erklärt Großbritannien Deutschland den Krieg. Aus dem Balkankonflikt ist ein europäischer Krieg geworden." },
      ],
    },

    fronten: {
      titel: "Die Fronten 1914–1918",
      legende: [["mm", "Mittelmächte"], ["en", "Entente"], ["front", "Frontlinie"]],
      linien: [],
      fronten: [
        { name: "Westfront", punkte: [[2.7, 51.1], [2.9, 50.85], [2.8, 50.3], [3.0, 49.6], [4.0, 49.25], [5.4, 49.2], [5.6, 48.9], [6.6, 48.7], [7.5, 47.6]] },
        { name: "Ostfront", punkte: [[24.1, 57.2], [26.4, 55.8], [26.0, 53.8], [25.8, 52.0], [25.4, 50.5], [25.6, 49.2], [26.2, 48.2]] },
        { name: "Alpenfront", punkte: [[10.5, 46.5], [12.0, 46.6], [13.6, 46.2], [13.5, 45.8]] },
        { name: "Salonikifront", punkte: [[20.8, 41.0], [22.4, 41.2], [24.0, 41.3]] },
      ],
      punkte: [
        { id: "westfront", lon: 5.4, lat: 49.2, label: "Westfront", bloc: "front", icon: "🪖", titel: "Westfront – der Stellungskrieg", text: "Nach dem Scheitern des Schlieffen-Plans an der Marne (September 1914) erstarrt die Front von der Nordsee bis zur Schweiz. Vier Jahre Schützengrabenkrieg: Ypern (1915: Giftgas), Verdun (1916), Somme (1916: erste Panzer), Frühjahrsoffensive und alliierte Gegenoffensive (1918)." },
        { id: "ostfront", lon: 22.0, lat: 54.0, label: "Ostfront", bloc: "front", icon: "❄️", titel: "Ostfront – Bewegungskrieg im Osten", text: "Die Front ist viel länger und dünner besetzt als im Westen, deshalb bleibt sie beweglicher. 1914 schlagen die Deutschen die Russen bei Tannenberg, 1915 erobern die Mittelmächte Polen. Nach der Revolution 1917 scheidet Russland aus; Frieden von Brest-Litowsk im März 1918." },
        { id: "alpen", lon: 13.6, lat: 46.0, label: "Alpen-/Isonzofront", bloc: "front", icon: "🏔️", titel: "Alpen- und Isonzofront", text: "Seit Mai 1915 kämpft Italien gegen Österreich-Ungarn – im Hochgebirge und in zwölf Isonzoschlachten. 1917 brechen die Mittelmächte bei Caporetto (Karfreit) durch." },
        { id: "balkan", lon: 21.5, lat: 43.0, label: "Balkanfront", bloc: "front", icon: "⛰️", titel: "Balkanfront", text: "Serbien hält 1914 stand, wird aber Ende 1915 von Österreich-Ungarn, Deutschland und Bulgarien besetzt. Die Entente landet Truppen in Saloniki. Im September 1918 bricht die Front zusammen – Bulgarien schließt als Erster Waffenstillstand." },
        { id: "gallipoli", lon: 26.4, lat: 40.4, label: "Gallipoli", bloc: "front", icon: "🚢", titel: "Gallipoli / Dardanellen 1915", text: "Britische, französische, australische und neuseeländische Truppen versuchen 1915, die Meerenge zum Schwarzen Meer zu öffnen. Das Osmanische Reich wehrt die Landung ab – ein schwerer Rückschlag für die Entente." },
        { id: "skagerrak", lon: 5.7, lat: 56.7, label: "Skagerrak", bloc: "front", icon: "⚓", titel: "Seekrieg – Skagerrakschlacht 1916", text: "Die einzige große Seeschlacht zwischen der deutschen Hochseeflotte und der britischen Grand Fleet (31. Mai/1. Juni 1916) bleibt ohne Entscheidung. Die britische Seeblockade hungert Deutschland aus (Steckrübenwinter 1916/17)." },
        { id: "atlantik", lon: -7.5, lat: 48.5, label: "U-Boot-Krieg", bloc: "front", icon: "🌊", titel: "Uneingeschränkter U-Boot-Krieg", text: "Ab Februar 1917 versenken deutsche U-Boote ohne Vorwarnung auch neutrale Handelsschiffe. Das führt im April 1917 zum Kriegseintritt der USA – und kippt langfristig das Kräfteverhältnis." },
      ],
    },

    kriegsende: {
      titel: "Orte des Kriegsendes 1918",
      legende: [["mm", "Mittelmächte"], ["en", "Entente"], ["ort", "Ereignisort"]],
      linien: [],
      punkte: [
        { id: "amiens", lon: 2.3, lat: 49.9, label: "Amiens", bloc: "ort", icon: "💥", titel: "8. August 1918 – Amiens", text: "Mit Panzern und Flugzeugen durchbrechen die Alliierten die deutschen Linien. General Ludendorff nennt den 8. August den „schwarzen Tag des deutschen Heeres“. Die Hundert-Tage-Offensive beginnt." },
        { id: "spa", lon: 5.9, lat: 50.5, label: "Spa", bloc: "ort", icon: "🏰", titel: "September–November 1918 – Spa", text: "Im Großen Hauptquartier in Spa (Belgien) verlangen Hindenburg und Ludendorff am 29. September einen sofortigen Waffenstillstand. Von hier flieht Wilhelm II. am 10. November ins niederländische Exil." },
        { id: "kiel", lon: 10.1, lat: 54.3, label: "Kiel", bloc: "ort", icon: "⚓", titel: "3./4. November 1918 – Kiel", text: "Matrosen verweigern das sinnlose Auslaufen der Flotte gegen die Briten. Aus der Meuterei wird ein Aufstand: Arbeiter- und Soldatenräte übernehmen die Stadt – die Novemberrevolution beginnt." },
        { id: "berlin", lon: 13.4, lat: 52.5, label: "Berlin", bloc: "ort", icon: "🏛️", titel: "9. November 1918 – Berlin", text: "Reichskanzler Max von Baden verkündet die Abdankung des Kaisers. Philipp Scheidemann (SPD) ruft die Republik aus, Karl Liebknecht die „sozialistische Republik“. Friedrich Ebert übernimmt die Regierung." },
        { id: "compiegne", lon: 2.8, lat: 49.4, label: "Compiègne", bloc: "ort", icon: "🚂", titel: "11. November 1918 – Compiègne", text: "In einem Eisenbahnwagen im Wald von Compiègne unterzeichnet Matthias Erzberger den Waffenstillstand. Um 11 Uhr schweigen die Waffen an der Westfront." },
        { id: "brest", lon: 23.7, lat: 52.1, label: "Brest-Litowsk", bloc: "ort", icon: "📜", titel: "3. März 1918 – Brest-Litowsk", text: "Sowjetrussland schließt einen harten Frieden mit den Mittelmächten und verliert riesige Gebiete. Deutschland kann Truppen nach Westen verlegen – die Grundlage für die Frühjahrsoffensive." },
        { id: "wien", lon: 16.4, lat: 48.2, label: "Wien", bloc: "ort", icon: "🧩", titel: "Oktober/November 1918 – Wien", text: "Die Nationalitäten erklären ihre Unabhängigkeit, Österreich-Ungarn zerfällt. Am 3. November schließt die Doppelmonarchie Waffenstillstand, am 11. November verzichtet Kaiser Karl I. auf die Regierungsgeschäfte." },
      ],
    },

    europa1920: {
      titel: "Europa nach den Pariser Vorortverträgen",
      legende: [["neu", "neuer oder wiederhergestellter Staat"], ["verlust", "Gebietsverlust Deutschlands"], ["rest", "Rest eines zerfallenen Reiches"]],
      linien: [],
      punkte: [
        { id: "warschau", lon: 21.0, lat: 52.2, label: "Polen", bloc: "neu", icon: "🆕", titel: "Polen", text: "Nach 123 Jahren Teilung wieder unabhängig. Erhält Posen und Westpreußen („Polnischer Korridor“ zur Ostsee) – Ostpreußen ist nun vom übrigen Reich getrennt." },
        { id: "prag", lon: 14.4, lat: 50.1, label: "Tschechoslowakei", bloc: "neu", icon: "🆕", titel: "Tschechoslowakei", text: "Neuer Staat aus Böhmen, Mähren und der Slowakei – mit einer großen deutschsprachigen Minderheit (Sudetenland)." },
        { id: "belgrad", lon: 20.5, lat: 44.8, label: "Jugoslawien", bloc: "neu", icon: "🆕", titel: "Königreich der Serben, Kroaten und Slowenen", text: "Der „SHS-Staat“ (ab 1929 Jugoslawien) vereint Serbien mit südslawischen Gebieten Österreich-Ungarns – das Ziel der serbischen Nationalisten von 1914." },
        { id: "wien", lon: 16.4, lat: 48.2, label: "Österreich", bloc: "rest", icon: "🧩", titel: "Österreich", text: "Kleiner Reststaat der Donaumonarchie (Vertrag von Saint-Germain 1919). Ein Anschluss an Deutschland wird verboten." },
        { id: "budapest", lon: 19.0, lat: 47.5, label: "Ungarn", bloc: "rest", icon: "🧩", titel: "Ungarn", text: "Verliert im Vertrag von Trianon (1920) rund zwei Drittel seines Gebiets an die Nachbarstaaten." },
        { id: "riga", lon: 24.1, lat: 56.95, label: "Baltische Staaten", bloc: "neu", icon: "🆕", titel: "Estland, Lettland, Litauen", text: "Die drei baltischen Staaten lösen sich vom zerfallenden Russischen Reich und werden 1918 unabhängig." },
        { id: "helsinki", lon: 24.9, lat: 60.2, label: "Finnland", bloc: "neu", icon: "🆕", titel: "Finnland", text: "Erklärt im Dezember 1917 seine Unabhängigkeit von Russland." },
        { id: "strassburg", lon: 7.75, lat: 48.6, label: "Elsass-Lothringen", bloc: "verlust", icon: "↩️", titel: "Elsass-Lothringen", text: "Fällt an Frankreich zurück – wie 1871 in umgekehrter Richtung. Mit dem Gebiet verliert Deutschland einen großen Teil seiner Eisenerzvorkommen." },
        { id: "danzig", lon: 18.65, lat: 54.35, label: "Danzig", bloc: "verlust", icon: "↩️", titel: "Freie Stadt Danzig", text: "Wird unter Verwaltung des Völkerbunds gestellt, damit Polen einen Hafen nutzen kann. Das Memelland fällt ebenfalls unter alliierte Verwaltung (1923 an Litauen)." },
        { id: "saar", lon: 7.0, lat: 49.2, label: "Saargebiet", bloc: "verlust", icon: "↩️", titel: "Saargebiet", text: "15 Jahre Völkerbundsverwaltung, die Kohlegruben gehen an Frankreich. 1935 stimmt die Bevölkerung für die Rückkehr zu Deutschland." },
        { id: "moskau", lon: 37.6, lat: 55.75, label: "Sowjetrussland", bloc: "rest", icon: "☭", titel: "Sowjetrussland / Sowjetunion", text: "Nach der Oktoberrevolution 1917 herrschen die Bolschewiki. Bis 1921 tobt ein Bürgerkrieg; 1922 wird die Sowjetunion gegründet." },
        { id: "ankara", lon: 32.9, lat: 39.9, label: "Türkei", bloc: "rest", icon: "🌙", titel: "Türkei", text: "Aus dem zerfallenen Osmanischen Reich entsteht 1923 die Republik Türkei. Die arabischen Gebiete werden britische und französische Mandatsgebiete." },
      ],
    },
  },

  // ─── Reiter mit Kompakt-Info und Aufgaben ─────────────────────────────
  tabs: [
    // ════════════════════════════════ URSACHEN ═════════════════════════
    {
      key: "ursachen", label: "Ursachen", icon: "🧭", kurz: "U",
      intro: {
        eyebrow: "Kompakt-Info M1", titel: "Langfristige Ursachen: Warum war Europa 1914 ein „Pulverfass“?",
        absaetze: [
          "<strong>Imperialismus:</strong> Die europäischen Großmächte wetteiferten um Kolonien, Rohstoffe und Absatzmärkte. Deutschland, erst 1871 gegründet, kam zu spät und forderte einen „Platz an der Sonne“. In den <strong>Marokkokrisen 1905 und 1911</strong> standen Deutschland und Frankreich kurz vor einem Krieg.",
          "<strong>Nationalismus:</strong> Viele Menschen hielten das eigene Volk für überlegen. Frankreich wollte das 1871 verlorene <strong>Elsass-Lothringen</strong> zurück. Serbische Nationalisten wollten alle Südslawen in einem Staat vereinen – eine Bedrohung für den Vielvölkerstaat Österreich-Ungarn.",
          "<strong>Militarismus und Wettrüsten:</strong> Das Militär genoss hohes Ansehen, Krieg galt als normales Mittel der Politik. Deutschland und Großbritannien lieferten sich ein <strong>Flottenwettrüsten</strong>, alle Großmächte vergrößerten ihre Heere. Die Generalstäbe hatten fertige Kriegspläne – Deutschland den <strong>Schlieffen-Plan</strong>: erst Frankreich schnell besiegen, dann gegen Russland kämpfen.",
          "<strong>Bündnissystem:</strong> Europa war in zwei Blöcke geteilt: der <strong>Dreibund</strong> (Deutschland, Österreich-Ungarn, Italien; 1882) und die <strong>Triple Entente</strong> (Frankreich, Russland, Großbritannien; 1907). Ein Streit zwischen zwei Staaten konnte so alle Großmächte in den Krieg ziehen. Besonders gefährlich war der <strong>Balkan</strong>, wo das Osmanische Reich Gebiete verlor und Österreich-Ungarn und Russland um Einfluss kämpften.",
        ],
        begriffe: ["Imperialismus", "Nationalismus", "Militarismus", "Wettrüsten", "Bündnissystem", "Dreibund", "Triple Entente", "Schlieffen-Plan", "Pulverfass Balkan"],
      },
      aufgaben: [
        {
          nr: 1, typ: "mc", eyebrow: "Grundwissen", titel: "Ursachen erkennen",
          niveaus: {
            A: { frage: "Welche Entwicklung war eine langfristige Ursache des Ersten Weltkriegs?", optionen: [
              { t: "Das Wettrüsten zwischen den europäischen Großmächten", ok: true },
              { t: "Die Erfindung des Automobils", ok: false },
              { t: "Die Gründung der Vereinten Nationen", ok: false },
            ] },
            B: { frage: "Was bedeutet „Bündnissystem“ im Zusammenhang mit 1914?", optionen: [
              { t: "Europa war in zwei Machtblöcke geteilt (Dreibund und Triple Entente), die sich gegenseitig Beistand versprochen hatten", ok: true },
              { t: "Alle europäischen Staaten hatten einen gemeinsamen Verteidigungsvertrag", ok: false },
              { t: "Deutschland stand 1914 ganz ohne Verbündete da", ok: false },
              { t: "Die Bündnisse verhinderten 1914 den Ausbruch des Krieges", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen beschreiben den Zusammenhang zwischen Imperialismus und Kriegsgefahr richtig?", optionen: [
              { t: "Der Wettlauf um Kolonien führte zu Krisen wie den Marokkokrisen 1905 und 1911", ok: true },
              { t: "Deutschland forderte als „verspätete Nation“ einen „Platz an der Sonne“ und geriet dadurch in Konflikt mit Großbritannien und Frankreich", ok: true },
              { t: "Die Kolonien wurden 1914 friedlich unter allen Staaten aufgeteilt", ok: false },
              { t: "Der Imperialismus betraf nur Staaten außerhalb Europas", ok: false },
            ] },
          },
        },
        {
          nr: 2, typ: "luecke", eyebrow: "Fachbegriffe", titel: "Vier Ursachen – vier Begriffe",
          niveaus: {
            A: { modus: "chips", ablenker: ["Pazifismus", "Demokratie"], text: "Der Wettlauf um Kolonien heißt [Imperialismus]. Die Überhöhung des eigenen Volkes nennt man [Nationalismus]. Das hohe Ansehen des Militärs und das Wettrüsten bezeichnet man als [Militarismus]. Durch feste [Bündnisse] wurde aus einem Streit zwischen zwei Staaten ein Krieg zwischen zwei Blöcken." },
            B: { modus: "input", text: "Frankreich wollte die 1871 verlorene Region [Elsass-Lothringen|Elsaß-Lothringen] zurück. Deutschland und Großbritannien lieferten sich ein [Flottenwettrüsten|Wettrüsten]. Der Balkan galt als [Pulverfass] Europas. Der [Schlieffen-Plan|Schlieffenplan] sah vor, Frankreich schnell zu besiegen, bevor Russland mobil machen konnte." },
            C: { modus: "input", text: "Weil Österreich-Ungarn ein [Vielvölkerstaat] war, bedrohte der serbische [Nationalismus] seinen Zusammenhalt. Russland unterstützte Serbien als Schutzmacht der [Slawen|slawischen Völker|Südslawen]. Deutschland hatte Österreich-Ungarn im [Zweibund|Dreibund] Beistand zugesagt. Frankreich und Russland waren seit [1894|1892] verbündet, Großbritannien schloss sich 1907 zur [Triple Entente|Entente] an. So konnte ein Konflikt auf dem Balkan ganz Europa in den Krieg ziehen." },
          },
        },
        {
          nr: 3, typ: "zuordnung", eyebrow: "Begriff und Beispiel", titel: "Welches Beispiel passt zu welcher Ursache?",
          niveaus: {
            A: { links: "Ursache", rechts: "Beispiel", paare: [
              ["Imperialismus", "Streit um Kolonien in Afrika (Marokkokrisen)"],
              ["Militarismus", "Flottenwettrüsten zwischen Deutschland und Großbritannien"],
              ["Nationalismus", "Frankreich will Elsass-Lothringen zurückerobern"],
            ] },
            B: { links: "Ursache", rechts: "Beispiel", paare: [
              ["Imperialismus", "Streit um Kolonien in Afrika (Marokkokrisen)"],
              ["Militarismus", "Flottenwettrüsten zwischen Deutschland und Großbritannien"],
              ["Nationalismus", "Frankreich will Elsass-Lothringen zurückerobern"],
              ["Bündnissystem", "Dreibund und Triple Entente stehen sich gegenüber"],
            ] },
            C: { links: "Begriff", rechts: "Erklärung", paare: [
              ["Imperialismus", "Wettlauf der Großmächte um Kolonien, Rohstoffe und Weltgeltung"],
              ["Militarismus", "Hohes Ansehen des Militärs; Krieg gilt als normales Mittel der Politik"],
              ["Nationalismus", "Überhöhung des eigenen Volkes und Abwertung anderer Nationen"],
              ["Bündnissystem", "Zwei Blöcke mit Beistandsversprechen machen jeden Konflikt zur Gefahr für ganz Europa"],
              ["Schlieffen-Plan", "Deutscher Kriegsplan: erst Frankreich schnell besiegen, dann gegen Russland"],
            ] },
          },
        },
        {
          nr: 4, typ: "sortierung", eyebrow: "Zeitliche Ordnung", titel: "Das Bündnissystem entsteht",
          niveaus: {
            A: { hinweis: "Bringe die Bündnisse in die richtige Reihenfolge (die Jahreszahlen helfen dir).", items: [
              "1879 · Zweibund: Deutschland und Österreich-Ungarn",
              "1882 · Dreibund: Italien tritt dem Zweibund bei",
              "1907 · Triple Entente: Frankreich, Russland und Großbritannien",
            ] },
            B: { hinweis: "Ordne ohne Jahreszahlen: Was kam zuerst?", items: [
              "Zweibund zwischen Deutschland und Österreich-Ungarn",
              "Dreibund: Italien tritt dem Bündnis bei",
              "Französisch-Russisches Bündnis",
              "Entente cordiale zwischen Großbritannien und Frankreich",
              "Triple Entente: Großbritannien und Russland einigen sich",
            ] },
            C: { hinweis: "Sieben Schritte zur Blockbildung – ohne Jahreszahlen.", items: [
              "Reichsgründung, Frankreich verliert Elsass-Lothringen",
              "Zweibund zwischen Deutschland und Österreich-Ungarn",
              "Dreibund: Italien tritt dem Bündnis bei",
              "Deutschland verlängert den Rückversicherungsvertrag mit Russland nicht",
              "Französisch-Russisches Bündnis",
              "Entente cordiale zwischen Großbritannien und Frankreich",
              "Triple Entente: Großbritannien und Russland einigen sich",
            ] },
          },
        },
        {
          nr: 5, typ: "diagramm", eyebrow: "Diagramm auswerten", titel: "Wettrüsten in Zahlen",
          chart: {
            typ: "bar", einheit: "Mio. £", yTitel: "Militärausgaben in Mio. Pfund",
            quelle: "Gerundete Werte nach P. Kennedy, The Rise and Fall of the Great Powers (1987). Tippe auf einen Balken.",
            labels: ["Deutsches Reich", "Großbritannien", "Frankreich", "Russland", "Österreich-Ungarn"],
            datasets: [
              { label: "1890", data: [29, 31, 37, 29, 13], farbe: "#9fb8cc" },
              { label: "1910", data: [64, 68, 52, 63, 17], farbe: "#4d8fc2" },
              { label: "1914", data: [111, 77, 57, 88, 36], farbe: "#AD007C" },
            ],
          },
          niveaus: {
            A: { frage: "Welches Land gab 1914 am meisten Geld für sein Militär aus?", optionen: [
              { t: "Das Deutsche Reich", ok: true }, { t: "Frankreich", ok: false }, { t: "Österreich-Ungarn", ok: false },
            ] },
            B: { frage: "Wie veränderten sich die deutschen Militärausgaben zwischen 1890 und 1914?", optionen: [
              { t: "Sie stiegen fast auf das Vierfache", ok: true }, { t: "Sie verdoppelten sich ungefähr", ok: false },
              { t: "Sie blieben etwa gleich", ok: false }, { t: "Sie halbierten sich", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Schlussfolgerungen lässt das Diagramm zu?", optionen: [
              { t: "Alle fünf Großmächte erhöhten ihre Ausgaben zwischen 1910 und 1914 deutlich – ein Hinweis auf das Wettrüsten", ok: true },
              { t: "Deutschland steigerte seine Ausgaben am stärksten und lag 1914 an der Spitze", ok: true },
              { t: "Großbritannien rüstete nach 1910 vollständig ab", ok: false },
              { t: "Das Diagramm beweist, dass Deutschland allein den Krieg wollte", ok: false },
            ] },
          },
        },
        {
          nr: 6, typ: "karte", eyebrow: "Karte erkunden", titel: "Europa 1914 – die Blöcke", karte: "europa1914",
          benoetigt: { A: 3, B: 6, C: 9 },
          niveaus: {
            A: { frage: "Welche Staaten bildeten die Triple Entente?", optionen: [
              { t: "Frankreich, Russland und Großbritannien", ok: true }, { t: "Deutschland, Österreich-Ungarn und Italien", ok: false }, { t: "Serbien, Belgien und Italien", ok: false },
            ] },
            B: { frage: "Warum blieb Italien 1914 trotz Dreibund zunächst neutral?", optionen: [
              { t: "Der Dreibund war ein Verteidigungsbündnis; Italien sah Österreich-Ungarn als Angreifer und verfolgte eigene Ziele (Trentino, Triest)", ok: true },
              { t: "Italien war nie Mitglied des Dreibunds", ok: false },
              { t: "Italien hatte 1914 keine Armee", ok: false },
              { t: "Großbritannien hatte Italien den Krieg erklärt", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zur geografischen Lage Deutschlands stimmen?", optionen: [
              { t: "Deutschland lag zwischen Frankreich und Russland – daher die Angst vor einem Zweifrontenkrieg", ok: true },
              { t: "Der Schlieffen-Plan war die militärische Antwort auf diese Lage: erst schnell im Westen siegen, dann nach Osten", ok: true },
              { t: "Deutschland hatte 1914 mehr verlässliche Verbündete als die Entente", ok: false },
              { t: "Großbritannien war 1914 mit Deutschland verbündet", ok: false },
            ] },
          },
        },
        {
          nr: 7, typ: "freitext", eyebrow: "Erklären", titel: "Pulverfass Europa",
          kontext: "Klasse 9 Geschichte, Abschnitt Ursachen. Wichtige Begriffe: Imperialismus, Nationalismus, Militarismus, Wettrüsten, Bündnissystem, Balkan.",
          niveaus: {
            A: { aufgabe: "Erkläre in 3–4 Sätzen, warum Europa 1914 als „Pulverfass“ bezeichnet wird.", starter: ["Ein Grund für den Krieg war …", "Außerdem …", "Die Bündnisse führten dazu, dass …"], begriffe: ["Nationalismus", "Wettrüsten", "Bündnisse"], min: 60 },
            B: { aufgabe: "Erkläre, warum ein Konflikt auf dem Balkan zu einem Krieg in ganz Europa werden konnte.", begriffe: ["Bündnissystem", "Nationalismus", "Großmacht", "Schutzmacht"], min: 100 },
            C: { aufgabe: "Beurteile: Welche der Ursachen (Imperialismus, Nationalismus, Militarismus, Bündnissystem) hältst du für die wichtigste? Begründe mit Beispielen und beziehe dich auf mindestens zwei Ursachen.", begriffe: ["Imperialismus", "Nationalismus", "Militarismus", "Bündnissystem", "Marokkokrise", "Elsass-Lothringen"], min: 150 },
          },
        },
        {
          nr: 8, typ: "notizen", eyebrow: "Recherche", titel: "Meine Stichpunkte: Ursachen", abschnitt: "ursachen",
          hinweis: "Wie auf dem Original-AB: Notiere stichpunktartig die wichtigsten Ursachen. Nutze die Kompakt-Info und mindestens eine eigene Quelle.",
          kiFrage: "Prüfe diese Recherche-Stichpunkte zu den Ursachen des Ersten Weltkriegs auf sachliche Richtigkeit und Vollständigkeit (Imperialismus, Nationalismus, Militarismus, Bündnissystem).",
        },
      ],
    },

    // ════════════════════════════════ AUSLÖSER ═════════════════════════
    {
      key: "ausloeser", label: "Auslöser", icon: "🎯", kurz: "A",
      intro: {
        eyebrow: "Kompakt-Info M2", titel: "Der Auslöser: Das Attentat von Sarajevo und die Julikrise",
        absaetze: [
          "Am <strong>28. Juni 1914</strong> erschoss der bosnisch-serbische Nationalist <strong>Gavrilo Princip</strong> in Sarajevo den österreichisch-ungarischen Thronfolger <strong>Franz Ferdinand</strong> und seine Frau Sophie. Princip gehörte zu einer Gruppe, die von der serbischen Geheimorganisation „Schwarze Hand“ unterstützt wurde. Österreich-Ungarn machte Serbien verantwortlich.",
          "Am <strong>5./6. Juli</strong> sicherte Deutschland seinem Verbündeten uneingeschränkte Unterstützung zu – den <strong>„Blankoscheck“</strong>. Am <strong>23. Juli</strong> stellte Wien Serbien ein <strong>Ultimatum</strong> mit fast unerfüllbaren Forderungen. Serbien nahm fast alle Punkte an, doch am <strong>28. Juli</strong> erklärte Österreich-Ungarn Serbien den Krieg.",
          "Jetzt griff das Bündnissystem: Russland machte am <strong>30. Juli</strong> als Schutzmacht Serbiens mobil. Deutschland erklärte am <strong>1. August</strong> Russland und am <strong>3. August</strong> Frankreich den Krieg. Am <strong>4. August</strong> marschierten deutsche Truppen in das neutrale <strong>Belgien</strong> ein – daraufhin erklärte Großbritannien Deutschland den Krieg.",
          "Diese fünf Wochen nennt man <strong>Julikrise</strong>. Das Attentat war nur der <strong>Auslöser</strong> (der „Funke“), die eigentlichen <strong>Ursachen</strong> (das „Pulverfass“) lagen tiefer. Viele Menschen jubelten im August 1914 – das sogenannte „Augusterlebnis“ –, doch die Begeisterung war längst nicht überall so groß, wie die Propaganda behauptete.",
        ],
        begriffe: ["Attentat von Sarajevo", "Gavrilo Princip", "Franz Ferdinand", "Blankoscheck", "Ultimatum", "Julikrise", "Mobilmachung", "Neutralität Belgiens", "Auslöser vs. Ursache"],
      },
      aufgaben: [
        {
          nr: 9, typ: "sortierung", eyebrow: "Kettenreaktion", titel: "Die Julikrise in der richtigen Reihenfolge",
          niveaus: {
            A: { hinweis: "Drei Stationen – die Daten helfen dir.", items: [
              "28. Juni · Attentat von Sarajevo",
              "28. Juli · Österreich-Ungarn erklärt Serbien den Krieg",
              "1. August · Deutschland erklärt Russland den Krieg",
            ] },
            B: { hinweis: "Fünf Stationen ohne Datum.", items: [
              "Attentat von Sarajevo auf Franz Ferdinand",
              "Deutschland gibt Österreich-Ungarn den „Blankoscheck“",
              "Österreich-Ungarn stellt Serbien ein Ultimatum",
              "Österreich-Ungarn erklärt Serbien den Krieg",
              "Deutschland erklärt Russland den Krieg",
            ] },
            C: { hinweis: "Sieben Stationen ohne Datum – vom Attentat bis zum Weltkrieg.", items: [
              "Attentat von Sarajevo auf Franz Ferdinand",
              "Deutschland gibt Österreich-Ungarn den „Blankoscheck“",
              "Österreich-Ungarn stellt Serbien ein 48-Stunden-Ultimatum",
              "Österreich-Ungarn erklärt Serbien den Krieg",
              "Russland ordnet die Generalmobilmachung an",
              "Deutschland erklärt Russland den Krieg",
              "Deutschland erklärt Frankreich den Krieg, marschiert in Belgien ein – Großbritannien tritt ein",
            ] },
          },
        },
        {
          nr: 10, typ: "mc", eyebrow: "Grundwissen", titel: "Das Attentat von Sarajevo",
          niveaus: {
            A: { frage: "Wer wurde am 28. Juni 1914 in Sarajevo ermordet?", optionen: [
              { t: "Der österreichisch-ungarische Thronfolger Franz Ferdinand und seine Frau Sophie", ok: true },
              { t: "Kaiser Wilhelm II.", ok: false },
              { t: "Der serbische König", ok: false },
            ] },
            B: { frage: "Warum sah Österreich-Ungarn Serbien als Schuldigen?", optionen: [
              { t: "Der Attentäter Gavrilo Princip war ein bosnisch-serbischer Nationalist mit Verbindungen zur serbischen Geheimorganisation „Schwarze Hand“", ok: true },
              { t: "Serbien hatte Österreich-Ungarn schon vor dem Attentat den Krieg erklärt", ok: false },
              { t: "Der serbische König hatte das Attentat öffentlich befohlen", ok: false },
              { t: "Serbische Truppen besetzten nach dem Attentat Sarajevo", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zum „Blankoscheck“ sind richtig?", optionen: [
              { t: "Deutschland sicherte Österreich-Ungarn am 5./6. Juli 1914 uneingeschränkte Unterstützung zu – egal, wie es gegen Serbien vorging", ok: true },
              { t: "Der Blankoscheck ermutigte Österreich-Ungarn zu einem harten Kurs und vergrößerte damit die Kriegsgefahr", ok: true },
              { t: "Der Blankoscheck war ein Geldbetrag zur Entschädigung Serbiens", ok: false },
              { t: "Großbritannien stellte Serbien den Blankoscheck aus", ok: false },
            ] },
          },
        },
        {
          nr: 11, typ: "luecke", eyebrow: "Fachbegriffe", titel: "Vom Attentat zum Krieg",
          niveaus: {
            A: { modus: "chips", ablenker: ["Paris", "Frieden"], text: "Am 28. Juni 1914 wurde der Thronfolger Franz Ferdinand in [Sarajevo] ermordet. Österreich-Ungarn machte [Serbien] verantwortlich und stellte ein [Ultimatum]. Wegen der [Bündnisse] wurde aus dem Konflikt schnell ein europäischer Krieg." },
            B: { modus: "input", text: "Der Attentäter hieß Gavrilo [Princip]. Deutschland gab Österreich-Ungarn den sogenannten [Blankoscheck]. Am [28]. Juli 1914 erklärte Österreich-Ungarn Serbien den Krieg. Russland reagierte mit der [Mobilmachung|Generalmobilmachung]. Der Einmarsch in das neutrale [Belgien] brachte Großbritannien in den Krieg." },
            C: { modus: "input", text: "Das Attentat war der [Auslöser], nicht die [Ursache] des Krieges. Die Wochen vom 28. Juni bis 4. August 1914 nennt man [Julikrise]. Russland verstand sich als [Schutzmacht] Serbiens. Deutschland musste wegen des [Schlieffen-Plans|Schlieffenplans|Schlieffen-Plan|Schlieffenplan] zuerst gegen Frankreich vorgehen, obwohl der Konflikt im Osten begann. Der Bruch der belgischen [Neutralität] gab Großbritannien den Grund zur Kriegserklärung." },
          },
        },
        {
          nr: 12, typ: "zuordnung", eyebrow: "Akteure", titel: "Wer tat was in der Julikrise?",
          niveaus: {
            A: { links: "Akteur", rechts: "Handlung", paare: [
              ["Gavrilo Princip", "Erschießt den Thronfolger in Sarajevo"],
              ["Österreich-Ungarn", "Stellt Serbien ein Ultimatum"],
              ["Deutschland", "Erklärt Russland und Frankreich den Krieg"],
            ] },
            B: { links: "Akteur", rechts: "Handlung", paare: [
              ["Gavrilo Princip", "Erschießt den Thronfolger in Sarajevo"],
              ["Österreich-Ungarn", "Stellt Serbien ein Ultimatum"],
              ["Russland", "Ordnet die Generalmobilmachung an"],
              ["Deutschland", "Erklärt Russland und Frankreich den Krieg"],
            ] },
            C: { links: "Akteur", rechts: "Handlung", paare: [
              ["Deutschland", "Gibt den Blankoscheck und erklärt später Russland und Frankreich den Krieg"],
              ["Österreich-Ungarn", "Stellt das Ultimatum und erklärt Serbien den Krieg"],
              ["Serbien", "Nimmt das Ultimatum fast vollständig an, lehnt aber einen Punkt ab"],
              ["Russland", "Macht als Schutzmacht Serbiens mobil"],
              ["Großbritannien", "Erklärt Deutschland nach dem Einmarsch in Belgien den Krieg"],
            ] },
          },
        },
        {
          nr: 13, typ: "diagramm", eyebrow: "Diagramm auswerten", titel: "Das Tempo der Krise",
          chart: {
            typ: "bar", horizontal: true, einheit: "Tage", yTitel: "Tage nach dem Attentat (28. Juni 1914)",
            quelle: "Zeitabstand der Ereignisse zum Attentat. Tippe auf einen Balken.",
            labels: ["Blankoscheck (5. Juli)", "Ultimatum an Serbien (23. Juli)", "Serbische Antwort (25. Juli)", "Kriegserklärung Ö-U an Serbien (28. Juli)", "Russische Mobilmachung (30. Juli)", "Kriegserklärung an Russland (1. Aug.)", "Kriegserklärung an Frankreich (3. Aug.)", "Einmarsch Belgien, GB tritt ein (4. Aug.)"],
            datasets: [{ label: "Tage nach dem Attentat", data: [7, 25, 27, 30, 32, 34, 36, 37], farbe: "#006AB3" }],
          },
          niveaus: {
            A: { frage: "Wie viele Tage lagen zwischen dem Attentat und der Kriegserklärung Österreich-Ungarns an Serbien?", optionen: [
              { t: "Etwa 30 Tage", ok: true }, { t: "Etwa 7 Tage", ok: false }, { t: "Etwa 100 Tage", ok: false },
            ] },
            B: { frage: "Was zeigt das Diagramm über das Tempo der Julikrise?", optionen: [
              { t: "Nach fast vier ruhigen Wochen folgten die Entscheidungen in der letzten Woche in immer kürzeren Abständen – eine Kettenreaktion", ok: true },
              { t: "Die Krise verlief von Anfang bis Ende gleichmäßig", ok: false },
              { t: "Die meisten Entscheidungen fielen in der ersten Woche nach dem Attentat", ok: false },
              { t: "Zwischen Attentat und Weltkrieg vergingen mehrere Monate", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Deutungen sind angemessen?", optionen: [
              { t: "Nach dem Ultimatum gab es fast keine Zeit mehr für Verhandlungen – Mobilmachungspläne und Bündnispflichten übernahmen das Tempo", ok: true },
              { t: "Die lange Pause bis zum 23. Juli zeigt, dass der Krieg nicht sofort unvermeidlich war – es gab Handlungsspielraum", ok: true },
              { t: "Das Diagramm beweist, dass Serbien den Krieg begonnen hat", ok: false },
              { t: "Das Diagramm zeigt die Zahl der Soldaten pro Land", ok: false },
            ] },
          },
        },
        {
          nr: 14, typ: "karte", eyebrow: "Karte erkunden", titel: "Julikrise – die Orte der Entscheidung", karte: "julikrise",
          benoetigt: { A: 3, B: 6, C: 8 },
          niveaus: {
            A: { frage: "In welcher Stadt fand das Attentat auf Franz Ferdinand statt?", optionen: [
              { t: "Sarajevo", ok: true }, { t: "Wien", ok: false }, { t: "Belgrad", ok: false },
            ] },
            B: { frage: "Warum konnte Österreich-Ungarn das Attentat in Sarajevo als Angriff auf sich selbst werten?", optionen: [
              { t: "Sarajevo lag in Bosnien, das Österreich-Ungarn 1908 annektiert hatte – das Attentat traf den Thronfolger im eigenen Staatsgebiet", ok: true },
              { t: "Sarajevo war die Hauptstadt Serbiens", ok: false },
              { t: "Sarajevo gehörte zu Deutschland", ok: false },
              { t: "Das Attentat fand in Wien statt", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zeigen, dass die Julikrise eine Kettenreaktion war?", optionen: [
              { t: "Jede Entscheidung in einer Hauptstadt löste eine Reaktion in einer anderen aus: Wien → Belgrad → St. Petersburg → Berlin → Paris → London", ok: true },
              { t: "Deutschland griff wegen des Schlieffen-Plans Frankreich und Belgien an, obwohl der Konflikt auf dem Balkan begann", ok: true },
              { t: "Alle Hauptstädte entschieden gleichzeitig und unabhängig voneinander", ok: false },
              { t: "Großbritannien erklärte als erstes Land den Krieg", ok: false },
            ] },
          },
        },
        {
          nr: 15, typ: "freitext", eyebrow: "Erklären", titel: "Funke oder Pulverfass?",
          kontext: "Klasse 9 Geschichte, Abschnitt Auslöser. Begriffe: Auslöser, Ursache, Attentat von Sarajevo, Julikrise, Blankoscheck, Bündnissystem, Kettenreaktion.",
          niveaus: {
            A: { aufgabe: "Erkläre mit eigenen Worten den Unterschied zwischen Auslöser und Ursache. Nutze das Bild vom Funken und vom Pulverfass.", starter: ["Der Auslöser war …", "Die Ursachen dagegen …", "Man kann sagen: …"], begriffe: ["Auslöser", "Ursache", "Attentat", "Bündnisse"], min: 60 },
            B: { aufgabe: "Erkläre, warum das Attentat von Sarajevo als Auslöser, nicht als Ursache des Ersten Weltkriegs gilt.", begriffe: ["Julikrise", "Bündnissystem", "Kettenreaktion", "Blankoscheck"], min: 100 },
            C: { aufgabe: "Diskutiere: Hätte der Krieg im Juli 1914 noch verhindert werden können? Nenne mindestens zwei Momente, an denen Politiker anders hätten entscheiden können, und beurteile ihre Bedeutung.", begriffe: ["Blankoscheck", "Ultimatum", "Mobilmachung", "Schlieffen-Plan", "Handlungsspielraum"], min: 150 },
          },
        },
        {
          nr: 16, typ: "notizen", eyebrow: "Recherche", titel: "Meine Stichpunkte: Auslöser", abschnitt: "ausloeser",
          hinweis: "Notiere die Stationen der Julikrise mit Datum in zeitlicher Ordnung. Vergiss die Quelle nicht.",
          kiFrage: "Prüfe diese Recherche-Stichpunkte zum Auslöser des Ersten Weltkriegs (Attentat von Sarajevo, Julikrise) auf sachliche Richtigkeit, Daten und zeitliche Ordnung.",
        },
      ],
    },

    // ════════════════════════════════ VERLAUF ══════════════════════════
    {
      key: "verlauf", label: "Verlauf", icon: "🪖", kurz: "V",
      intro: {
        eyebrow: "Kompakt-Info M3", titel: "Der Verlauf: Vom Bewegungskrieg zur Materialschlacht",
        absaetze: [
          "<strong>1914:</strong> Der Schlieffen-Plan scheiterte im September in der <strong>Marneschlacht</strong> – die Deutschen wurden vor Paris gestoppt. Die Westfront erstarrte zum <strong>Stellungskrieg</strong>: Schützengräben von der Nordsee bis zur Schweiz. Im Osten besiegte Deutschland die Russen bei <strong>Tannenberg</strong>; die Ostfront blieb beweglicher.",
          "<strong>1915/1916:</strong> Bei <strong>Ypern</strong> setzte Deutschland 1915 erstmals Giftgas ein. Italien trat auf Seiten der Entente ein. 1916 tobten die <strong>Materialschlachten</strong> um <strong>Verdun</strong> (rund 700.000 Tote und Verwundete) und an der <strong>Somme</strong> (über eine Million Verluste, erste Panzer) – ohne dass sich die Front wesentlich verschob. Maschinengewehre und Artillerie machten jeden Angriff zum Massensterben.",
          "<strong>1917:</strong> Der <strong>uneingeschränkte U-Boot-Krieg</strong> führte im April zum <strong>Kriegseintritt der USA</strong>. In Russland stürzten die Revolutionen den Zaren; die Bolschewiki schlossen im März 1918 den Frieden von <strong>Brest-Litowsk</strong>.",
          "<strong>Totaler Krieg:</strong> Der Krieg erfasste die ganze Gesellschaft: Frauen arbeiteten in Rüstungsfabriken, die britische Seeblockade führte zum <strong>„Steckrübenwinter“</strong> 1916/17 mit Hunger in Deutschland, Propaganda lenkte die Stimmung. <strong>1918:</strong> Die deutsche Frühjahrsoffensive scheiterte; ab dem <strong>8. August</strong>, dem „schwarzen Tag des deutschen Heeres“, drängten die Alliierten mit Panzern und frischen US-Truppen die Deutschen zurück.",
        ],
        begriffe: ["Schlieffen-Plan", "Marneschlacht", "Stellungskrieg", "Zweifrontenkrieg", "Materialschlacht", "Verdun", "Somme", "Giftgas", "U-Boot-Krieg", "Kriegseintritt der USA", "totaler Krieg", "Heimatfront"],
      },
      aufgaben: [
        {
          nr: 17, typ: "mc", eyebrow: "Grundwissen", titel: "Vom Bewegungskrieg zum Stellungskrieg",
          niveaus: {
            A: { frage: "Was ist ein Stellungskrieg?", optionen: [
              { t: "Die Fronten bewegen sich kaum; die Soldaten liegen sich monatelang in Schützengräben gegenüber", ok: true },
              { t: "Ein Krieg, der nur auf See geführt wird", ok: false },
              { t: "Ein Krieg, bei dem sich die Armeen schnell durch das Land bewegen", ok: false },
            ] },
            B: { frage: "Warum scheiterte der Schlieffen-Plan 1914?", optionen: [
              { t: "In der Marneschlacht (September 1914) wurde der deutsche Vormarsch vor Paris gestoppt – der schnelle Sieg im Westen blieb aus", ok: true },
              { t: "Russland griff Deutschland nicht an", ok: false },
              { t: "Frankreich kapitulierte sofort", ok: false },
              { t: "Der Plan sah gar keinen Angriff auf Frankreich vor", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zur „Materialschlacht“ sind richtig?", optionen: [
              { t: "Bei Verdun und an der Somme 1916 starben Hunderttausende, ohne dass sich die Front wesentlich verschob", ok: true },
              { t: "Massenhaft eingesetzte Artillerie, Maschinengewehre und Munition sollten den Gegner „ausbluten“", ok: true },
              { t: "Die Materialschlachten brachten 1916 den entscheidenden Durchbruch im Westen", ok: false },
              { t: "„Materialschlacht“ bedeutet, dass nur Material, aber keine Menschen zu Schaden kamen", ok: false },
            ] },
          },
        },
        {
          nr: 18, typ: "luecke", eyebrow: "Fachbegriffe", titel: "Der Krieg in Stichworten",
          niveaus: {
            A: { modus: "chips", ablenker: ["Rom", "Fahrräder"], text: "1914 stoppten die Franzosen den deutschen Vormarsch an der [Marne]. Danach erstarrte die Westfront in [Schützengräben]. 1916 tobte die Schlacht um [Verdun]. 1917 traten die [USA] in den Krieg ein." },
            B: { modus: "input", text: "Der deutsche Angriffsplan hieß [Schlieffen-Plan|Schlieffenplan]. An der Ostfront besiegte Deutschland 1914 die Russen bei [Tannenberg]. 1915 setzte Deutschland bei Ypern erstmals [Giftgas|Gas|Chlorgas] ein. Der uneingeschränkte [U-Boot-Krieg|U-Bootkrieg|Ubootkrieg|U-Boot Krieg] führte 1917 zum Kriegseintritt der USA. Nach der Revolution schied [Russland] 1917/18 aus dem Krieg aus." },
            C: { modus: "input", text: "Deutschland führte einen [Zweifrontenkrieg] gegen Frankreich und Russland. Der Krieg wurde zum [totalen|totaler] Krieg, weil auch die Zivilbevölkerung an der [Heimatfront] einbezogen wurde. Im [Steckrübenwinter|Hungerwinter|Kohlrübenwinter] 1916/17 hungerten die Menschen in Deutschland. Der Frieden von [Brest-Litowsk|Brest Litowsk|Brest-Litovsk] beendete im März 1918 den Krieg im Osten. Die deutsche [Frühjahrsoffensive] 1918 scheiterte, und ab dem 8. August, dem „schwarzen Tag des deutschen Heeres“, drängten die Alliierten die Deutschen zurück." },
          },
        },
        {
          nr: 19, typ: "zuordnung", eyebrow: "Jahr und Ereignis", titel: "Was geschah wann?",
          niveaus: {
            A: { links: "Jahr", rechts: "Ereignis", paare: [
              ["1914", "Marneschlacht – der Stellungskrieg beginnt"],
              ["1916", "Schlacht um Verdun"],
              ["1917", "Kriegseintritt der USA"],
            ] },
            B: { links: "Jahr", rechts: "Ereignis", paare: [
              ["1914", "Marneschlacht – der Stellungskrieg beginnt"],
              ["1915", "Erster Giftgaseinsatz bei Ypern"],
              ["1916", "Schlacht um Verdun"],
              ["1917", "Kriegseintritt der USA"],
            ] },
            C: { links: "Jahr", rechts: "Ereignisse", paare: [
              ["1914", "Marneschlacht und Tannenberg – Zweifrontenkrieg beginnt"],
              ["1915", "Giftgas bei Ypern, Italien tritt gegen Österreich-Ungarn ein"],
              ["1916", "Materialschlachten um Verdun und an der Somme, Skagerrakschlacht"],
              ["1917", "USA treten ein, Russland scheidet nach der Revolution aus"],
              ["1918", "Frühjahrsoffensive scheitert, Hundert-Tage-Offensive der Alliierten"],
            ] },
          },
        },
        {
          nr: 20, typ: "sortierung", eyebrow: "Zeitliche Ordnung", titel: "Kriegsverlauf 1914–1918",
          niveaus: {
            A: { hinweis: "Drei Wendepunkte – mit Jahreszahl.", items: [
              "1914 · Marneschlacht: Der Schlieffen-Plan scheitert",
              "1916 · Schlacht um Verdun",
              "1917 · Kriegseintritt der USA",
            ] },
            B: { hinweis: "Fünf Ereignisse ohne Jahreszahl.", items: [
              "Marneschlacht: Der Schlieffen-Plan scheitert",
              "Erster Giftgaseinsatz bei Ypern",
              "Materialschlachten um Verdun und an der Somme",
              "Kriegseintritt der USA",
              "Frieden von Brest-Litowsk mit Sowjetrussland",
            ] },
            C: { hinweis: "Sieben Ereignisse ohne Jahreszahl.", items: [
              "Marneschlacht: Der Schlieffen-Plan scheitert",
              "Kriegseintritt Italiens gegen Österreich-Ungarn",
              "Beginn der Schlacht um Verdun",
              "Somme-Schlacht mit den ersten Panzern",
              "Beginn des uneingeschränkten U-Boot-Krieges",
              "Kriegseintritt der USA",
              "Frieden von Brest-Litowsk mit Sowjetrussland",
            ] },
          },
        },
        {
          nr: 21, typ: "diagramm", eyebrow: "Diagramm auswerten", titel: "Der Preis des Krieges",
          chart: {
            typ: "bar", einheit: "Mio.", yTitel: "Gefallene Soldaten in Millionen (gerundet)",
            quelle: "Gerundete Schätzwerte; verschiedene Quellen nennen abweichende Zahlen. Tippe auf einen Balken.",
            labels: ["Deutsches Reich", "Russland", "Frankreich", "Österreich-Ungarn", "Großbritannien (mit Empire)", "Osmanisches Reich", "Italien", "USA"],
            datasets: [{ label: "Gefallene Soldaten (Mio.)", data: [2.0, 1.8, 1.4, 1.1, 0.9, 0.8, 0.65, 0.12], farben: ["#8b1e2d", "#006AB3", "#006AB3", "#8b1e2d", "#006AB3", "#8b1e2d", "#006AB3", "#006AB3"] }],
            legendeExtra: "rot = Mittelmächte, blau = Entente",
          },
          niveaus: {
            A: { frage: "Welches Land hatte die meisten gefallenen Soldaten?", optionen: [
              { t: "Das Deutsche Reich", ok: true }, { t: "Die USA", ok: false }, { t: "Italien", ok: false },
            ] },
            B: { frage: "Warum hatten die USA vergleichsweise wenige Gefallene?", optionen: [
              { t: "Sie traten erst im April 1917 ein und kämpften erst ab 1918 in großer Zahl", ok: true },
              { t: "Ihre Soldaten hatten bessere Waffen als alle anderen", ok: false },
              { t: "Sie kämpften nur auf See", ok: false },
              { t: "Sie waren mit Deutschland verbündet", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zum Umgang mit diesem Diagramm sind richtig?", optionen: [
              { t: "Die Zahlen sind Schätzungen – verschiedene Quellen nennen unterschiedliche Werte, deshalb muss man die Quelle prüfen", ok: true },
              { t: "Beide Blöcke verloren Millionen Soldaten – es gab keinen „billigen“ Sieg", ok: true },
              { t: "Das Diagramm zeigt auch die zivilen Opfer und die Toten der Spanischen Grippe", ok: false },
              { t: "Die Zahlen beweisen, dass Deutschland den Krieg gewonnen hat", ok: false },
            ] },
          },
        },
        {
          nr: 22, typ: "karte", eyebrow: "Karte erkunden", titel: "Die Fronten des Krieges", karte: "fronten",
          benoetigt: { A: 3, B: 5, C: 7 },
          niveaus: {
            A: { frage: "An welcher Front standen sich Deutschland und Frankreich gegenüber?", optionen: [
              { t: "An der Westfront", ok: true }, { t: "An der Ostfront", ok: false }, { t: "An der Alpenfront", ok: false },
            ] },
            B: { frage: "Warum blieb die Ostfront beweglicher als die Westfront?", optionen: [
              { t: "Die Ostfront war viel länger und dünner besetzt – Durchbrüche und Bewegungskrieg blieben möglich", ok: true },
              { t: "Im Osten gab es keine Maschinengewehre", ok: false },
              { t: "Russland hatte gar keine Armee", ok: false },
              { t: "Die Ostfront lag am Meer", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zum Seekrieg stimmen?", optionen: [
              { t: "Die britische Seeblockade schnitt Deutschland von Importen ab und trug zum Hunger an der Heimatfront bei", ok: true },
              { t: "Der uneingeschränkte U-Boot-Krieg brachte 1917 die USA in den Krieg – ein strategischer Fehler Deutschlands", ok: true },
              { t: "Die Skagerrakschlacht 1916 vernichtete die britische Flotte vollständig", ok: false },
              { t: "Deutschland kontrollierte den Atlantik bis Kriegsende", ok: false },
            ] },
          },
        },
        {
          nr: 23, typ: "freitext", eyebrow: "Erklären", titel: "Warum erstarrte die Front?",
          kontext: "Klasse 9 Geschichte, Abschnitt Verlauf. Begriffe: Marneschlacht, Schützengraben, Maschinengewehr, Artillerie, Stellungskrieg, Materialschlacht, totaler Krieg, Heimatfront.",
          niveaus: {
            A: { aufgabe: "Erkläre in 3–4 Sätzen, warum aus dem Bewegungskrieg 1914 ein Stellungskrieg wurde.", starter: ["Zuerst …", "Aber dann …", "Deshalb …"], begriffe: ["Marne", "Schützengraben", "Maschinengewehr"], min: 60 },
            B: { aufgabe: "Erkläre, warum neue Waffen (Maschinengewehr, Artillerie, Giftgas) den Stellungskrieg so verlustreich machten – und warum trotzdem kaum Gelände gewonnen wurde.", begriffe: ["Stellungskrieg", "Materialschlacht", "Verdun", "Verteidigung"], min: 100 },
            C: { aufgabe: "Erläutere den Begriff „totaler Krieg“ am Beispiel des Ersten Weltkriegs. Gehe auf Heimatfront, Wirtschaft, Propaganda und Zivilbevölkerung ein und beurteile, welche Bedeutung der Kriegseintritt der USA hatte.", begriffe: ["totaler Krieg", "Heimatfront", "Seeblockade", "Propaganda", "USA"], min: 150 },
          },
        },
        {
          nr: 24, typ: "notizen", eyebrow: "Recherche", titel: "Meine Stichpunkte: Verlauf", abschnitt: "verlauf",
          hinweis: "Ordne den Verlauf nach Jahren (1914, 1915, 1916, 1917, 1918). Ein Stichpunkt pro wichtigem Ereignis.",
          kiFrage: "Prüfe diese Recherche-Stichpunkte zum Verlauf des Ersten Weltkriegs (1914–1918) auf sachliche Richtigkeit, Jahreszahlen und zeitliche Ordnung.",
        },
      ],
    },

    // ════════════════════════════════ KRIEGSENDE ═══════════════════════
    {
      key: "kriegsende", label: "Kriegsende", icon: "🕊️", kurz: "K",
      intro: {
        eyebrow: "Kompakt-Info M4", titel: "Das Kriegsende: Niederlage, Revolution, Waffenstillstand",
        absaetze: [
          "Im Sommer 1918 war der Krieg für Deutschland militärisch verloren: Die Frühjahrsoffensive war gescheitert, täglich trafen rund 10.000 frische US-Soldaten in Frankreich ein, die Heimat hungerte. Am <strong>29. September 1918</strong> verlangte die <strong>Oberste Heeresleitung</strong> (Hindenburg und Ludendorff) einen sofortigen Waffenstillstand. Grundlage sollten die <strong>14 Punkte</strong> des US-Präsidenten <strong>Wilson</strong> sein (Selbstbestimmungsrecht der Völker, Völkerbund).",
          "Mit den <strong>Oktoberreformen</strong> wurde das Kaiserreich parlamentarisiert: Prinz <strong>Max von Baden</strong> wurde Reichskanzler und war nun vom Reichstag abhängig. Gleichzeitig brachen die Verbündeten weg: Bulgarien (29. September), das Osmanische Reich (30. Oktober) und Österreich-Ungarn (3. November) schlossen Waffenstillstände.",
          "Als die Marineführung die Flotte zu einer letzten, aussichtslosen Schlacht auslaufen lassen wollte, verweigerten die Matrosen den Befehl. Der <strong>Matrosenaufstand in Kiel</strong> (3./4. November) wurde zur <strong>Novemberrevolution</strong>: Überall bildeten sich Arbeiter- und Soldatenräte. Am <strong>9. November 1918</strong> wurde die Abdankung Kaiser Wilhelms II. verkündet; <strong>Philipp Scheidemann</strong> rief die Republik aus, <strong>Friedrich Ebert</strong> (SPD) übernahm die Regierung.",
          "Am <strong>11. November 1918</strong> unterzeichnete Matthias Erzberger im Wald von <strong>Compiègne</strong> den Waffenstillstand. Ludendorff und andere verbreiteten später die <strong>Dolchstoßlegende</strong>: Das „im Felde unbesiegte“ Heer sei von der Heimat verraten worden. Das war falsch – die Militärführung selbst hatte den Waffenstillstand gefordert. Die Lüge belastete die junge Republik schwer.",
        ],
        begriffe: ["Oberste Heeresleitung", "Hindenburg", "Ludendorff", "14 Punkte Wilsons", "Oktoberreformen", "Matrosenaufstand", "Novemberrevolution", "Ausrufung der Republik", "Waffenstillstand von Compiègne", "Dolchstoßlegende"],
      },
      aufgaben: [
        {
          nr: 25, typ: "mc", eyebrow: "Grundwissen", titel: "Warum verlor Deutschland?",
          niveaus: {
            A: { frage: "Wann trat der Waffenstillstand des Ersten Weltkriegs in Kraft?", optionen: [
              { t: "Am 11. November 1918", ok: true }, { t: "Am 28. Juni 1914", ok: false }, { t: "Am 8. Mai 1945", ok: false },
            ] },
            B: { frage: "Welche Bedeutung hatte der Kriegseintritt der USA 1917 für das Kriegsende?", optionen: [
              { t: "Frische Soldaten, Waffen und Lebensmittel kippten das Kräfteverhältnis dauerhaft zugunsten der Alliierten", ok: true },
              { t: "Die USA kämpften auf Seiten Deutschlands", ok: false },
              { t: "Die USA blieben bis Kriegsende neutral", ok: false },
              { t: "Die USA schickten nur Geld, aber keine Soldaten", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zur Dolchstoßlegende sind richtig?", optionen: [
              { t: "Die Legende behauptete, das „im Felde unbesiegte“ Heer sei von der Heimat – Revolutionären und Politikern – „von hinten erdolcht“ worden", ok: true },
              { t: "Tatsächlich hatte die Oberste Heeresleitung selbst Ende September 1918 den Waffenstillstand gefordert, weil der Krieg militärisch verloren war", ok: true },
              { t: "Die Dolchstoßlegende wurde 1919 von den Alliierten erfunden", ok: false },
              { t: "Die Legende beschreibt den Kriegsverlauf von 1918 zutreffend", ok: false },
            ] },
          },
        },
        {
          nr: 26, typ: "luecke", eyebrow: "Fachbegriffe", titel: "Die letzten Monate",
          niveaus: {
            A: { modus: "chips", ablenker: ["Sieg", "Paris"], text: "In [Kiel] weigerten sich Matrosen im November 1918, noch einmal auszulaufen. Am 9. November wurde in Berlin die [Republik] ausgerufen. Am 11. November 1918 trat der [Waffenstillstand] in Kraft. Der Kriegseintritt der [USA] hatte das Kräfteverhältnis verändert." },
            B: { modus: "input", text: "Ende September 1918 verlangte die Oberste Heeresleitung um Hindenburg und [Ludendorff] einen Waffenstillstand. Der Matrosenaufstand in [Kiel] löste die [Novemberrevolution] aus. Kaiser [Wilhelm II.|Wilhelm II|Wilhelm] dankte ab und floh in die Niederlande. Philipp [Scheidemann] rief am 9. November die Republik aus. Der Waffenstillstand wurde in [Compiègne|Compiegne] unterzeichnet." },
            C: { modus: "input", text: "Grundlage der Verhandlungen waren die [14 Punkte|vierzehn Punkte|14-Punkte] des US-Präsidenten Wilson. Mit den [Oktoberreformen] wurde das Reich parlamentarisiert, Prinz Max von [Baden] wurde Reichskanzler. Nacheinander schieden Bulgarien, das [Osmanische Reich|Osmanische] und Österreich-Ungarn aus dem Krieg aus. Friedrich [Ebert] übernahm am 9. November die Regierung. Die [Dolchstoßlegende|Dolchstosslegende] schob die Schuld an der Niederlage auf die Heimat statt auf die militärische Führung." },
          },
        },
        {
          nr: 27, typ: "sortierung", eyebrow: "Zeitliche Ordnung", titel: "Vom Sommer 1918 zum Waffenstillstand",
          niveaus: {
            A: { hinweis: "Drei Daten des Jahres 1918.", items: [
              "8. August 1918 · „Schwarzer Tag des deutschen Heeres“",
              "9. November 1918 · Ausrufung der Republik",
              "11. November 1918 · Waffenstillstand von Compiègne",
            ] },
            B: { hinweis: "Fünf Schritte ohne Datum.", items: [
              "Die deutsche Frühjahrsoffensive scheitert",
              "Alliierte Gegenoffensive: „Schwarzer Tag des deutschen Heeres“",
              "Die Oberste Heeresleitung fordert einen Waffenstillstand",
              "Matrosenaufstand in Kiel",
              "Waffenstillstand von Compiègne",
            ] },
            C: { hinweis: "Sieben Schritte ohne Datum.", items: [
              "Die deutsche Frühjahrsoffensive scheitert",
              "Alliierte Gegenoffensive: „Schwarzer Tag des deutschen Heeres“",
              "Die Oberste Heeresleitung fordert einen Waffenstillstand",
              "Oktoberreformen: Prinz Max von Baden wird Reichskanzler",
              "Matrosenaufstand in Kiel",
              "Ausrufung der Republik in Berlin",
              "Waffenstillstand von Compiègne",
            ] },
          },
        },
        {
          nr: 28, typ: "zuordnung", eyebrow: "Begriffe", titel: "Begriffe des Kriegsendes",
          niveaus: {
            A: { links: "Begriff", rechts: "Erklärung", paare: [
              ["Waffenstillstand", "Vereinbarung, die Kämpfe zu beenden – noch kein Friedensvertrag"],
              ["Novemberrevolution", "Aufstände von Matrosen, Soldaten und Arbeitern, die die Monarchie stürzten"],
              ["14 Punkte", "Friedensprogramm des US-Präsidenten Wilson"],
            ] },
            B: { links: "Begriff", rechts: "Erklärung", paare: [
              ["Waffenstillstand", "Vereinbarung, die Kämpfe zu beenden – noch kein Friedensvertrag"],
              ["Novemberrevolution", "Aufstände von Matrosen, Soldaten und Arbeitern, die die Monarchie stürzten"],
              ["14 Punkte", "Friedensprogramm des US-Präsidenten Wilson"],
              ["Dolchstoßlegende", "Falsche Behauptung, das Heer sei von der Heimat verraten worden"],
            ] },
            C: { links: "Begriff", rechts: "Erklärung", paare: [
              ["Waffenstillstand", "Vereinbarung, die Kämpfe zu beenden – noch kein Friedensvertrag"],
              ["Novemberrevolution", "Aufstände von Matrosen, Soldaten und Arbeitern, die die Monarchie stürzten"],
              ["14 Punkte", "Friedensprogramm Wilsons: Selbstbestimmungsrecht der Völker, Völkerbund"],
              ["Dolchstoßlegende", "Falsche Behauptung, das Heer sei von der Heimat verraten worden"],
              ["Oktoberreformen", "Verfassungsänderung 1918: Der Reichskanzler wird vom Reichstag abhängig"],
            ] },
          },
        },
        {
          nr: 29, typ: "diagramm", eyebrow: "Diagramm auswerten", titel: "Das Kräfteverhältnis kippt",
          chart: {
            typ: "line", einheit: "Tsd.", yTitel: "US-Soldaten in Frankreich (in Tausend)",
            quelle: "Gerundete Werte zum Monatsende nach Angaben der American Expeditionary Forces. Tippe auf einen Punkt.",
            labels: ["Dez 1917", "Feb 1918", "Apr 1918", "Jun 1918", "Aug 1918", "Okt 1918", "Nov 1918"],
            datasets: [{ label: "US-Soldaten in Frankreich (Tsd.)", data: [175, 250, 430, 900, 1470, 1870, 2000], farbe: "#006AB3" }],
          },
          niveaus: {
            A: { frage: "Wie viele US-Soldaten waren im November 1918 etwa in Frankreich?", optionen: [
              { t: "Rund 2 Millionen", ok: true }, { t: "Rund 20.000", ok: false }, { t: "Rund 200", ok: false },
            ] },
            B: { frage: "Welche Folge hatte diese Entwicklung für die deutsche Führung?", optionen: [
              { t: "Sie versuchte im Frühjahr 1918 einen letzten Durchbruch, bevor die US-Truppen in voller Stärke wirksam wurden", ok: true },
              { t: "Sie zog alle Truppen aus Frankreich ab", ok: false },
              { t: "Sie schloss 1917 Frieden mit den USA", ok: false },
              { t: "Sie schickte selbst Soldaten in die USA", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Schlussfolgerungen sind richtig?", optionen: [
              { t: "Die Kurve erklärt, warum die deutsche Frühjahrsoffensive unter Zeitdruck stand", ok: true },
              { t: "Ab Sommer 1918 verschob sich das Kräfteverhältnis dauerhaft zugunsten der Alliierten", ok: true },
              { t: "Die US-Truppen kämpften bereits 1914 in großer Zahl in Frankreich", ok: false },
              { t: "Die Kurve zeigt die deutschen Verluste", ok: false },
            ] },
          },
        },
        {
          nr: 30, typ: "karte", eyebrow: "Karte erkunden", titel: "Orte des Kriegsendes", karte: "kriegsende",
          benoetigt: { A: 3, B: 5, C: 7 },
          niveaus: {
            A: { frage: "Wo begann die Novemberrevolution?", optionen: [
              { t: "In Kiel", ok: true }, { t: "In Compiègne", ok: false }, { t: "In Wien", ok: false },
            ] },
            B: { frage: "Wo wurde der Waffenstillstand am 11. November 1918 unterzeichnet?", optionen: [
              { t: "In einem Eisenbahnwagen im Wald von Compiègne", ok: true },
              { t: "Im Schloss von Versailles", ok: false },
              { t: "Im Großen Hauptquartier in Spa", ok: false },
              { t: "Im Berliner Reichstag", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Zusammenhänge zeigt die Karte?", optionen: [
              { t: "Der Frieden von Brest-Litowsk im Osten machte die Frühjahrsoffensive im Westen erst möglich – und trotzdem reichte es nicht", ok: true },
              { t: "Die Niederlage begann an der Front (Amiens, Spa), die Revolution in der Heimat (Kiel, Berlin) folgte erst danach", ok: true },
              { t: "Die Revolution in Kiel zwang die siegreiche Armee zur Aufgabe", ok: false },
              { t: "Der Waffenstillstand wurde in Berlin unterzeichnet", ok: false },
            ] },
          },
        },
        {
          nr: 31, typ: "freitext", eyebrow: "Erklären", titel: "Warum endete der Krieg 1918?",
          kontext: "Klasse 9 Geschichte, Abschnitt Kriegsende. Begriffe: Kriegseintritt der USA, Erschöpfung, Hunger, Seeblockade, Bündnispartner, Oberste Heeresleitung, Novemberrevolution, Waffenstillstand, Dolchstoßlegende.",
          niveaus: {
            A: { aufgabe: "Erkläre in 3–4 Sätzen, warum Deutschland den Krieg 1918 verlor.", starter: ["Ein wichtiger Grund war …", "Außerdem …", "Am Ende …"], begriffe: ["USA", "Hunger", "Revolution"], min: 60 },
            B: { aufgabe: "Erkläre, warum Deutschland den Krieg 1918 verlor. Nenne mindestens drei Gründe – einen militärischen, einen wirtschaftlichen und einen politischen.", begriffe: ["Frühjahrsoffensive", "USA", "Seeblockade", "Bündnispartner", "Novemberrevolution"], min: 100 },
            C: { aufgabe: "Beurteile die Dolchstoßlegende: Warum war sie sachlich falsch – und warum war sie trotzdem für die Weimarer Republik so gefährlich?", begriffe: ["Oberste Heeresleitung", "29. September 1918", "Novemberrevolution", "Weimarer Republik", "Propaganda"], min: 150 },
          },
        },
        {
          nr: 32, typ: "notizen", eyebrow: "Recherche", titel: "Meine Stichpunkte: Kriegsende", abschnitt: "kriegsende",
          hinweis: "Notiere die Schritte von der militärischen Niederlage bis zum Waffenstillstand – mit Daten.",
          kiFrage: "Prüfe diese Recherche-Stichpunkte zum Kriegsende 1918 (Oberste Heeresleitung, Novemberrevolution, Waffenstillstand) auf sachliche Richtigkeit, Daten und zeitliche Ordnung.",
        },
      ],
    },

    // ════════════════════════════════ FOLGEN ═══════════════════════════
    {
      key: "folgen", label: "Folgen", icon: "🧩", kurz: "F",
      intro: {
        eyebrow: "Kompakt-Info M5", titel: "Die Folgen: Ein neues Europa und die „Urkatastrophe“",
        absaetze: [
          "<strong>Menschliche Verluste:</strong> Rund 9 bis 10 Millionen Soldaten und etwa 6 bis 7 Millionen Zivilisten starben, dazu kamen Millionen Verwundete und Kriegsversehrte. Die <strong>Spanische Grippe</strong> 1918–1920 forderte weltweit weitere Millionen Opfer. Eine ganze Generation war traumatisiert.",
          "<strong>Versailler Vertrag (28. Juni 1919):</strong> Deutschland durfte nicht mitverhandeln. Es musste den <strong>Kriegsschuldartikel 231</strong> anerkennen, <strong>Reparationen</strong> zahlen (1921 auf 132 Milliarden Goldmark festgelegt), rund <strong>13 Prozent seines Gebiets</strong> abtreten (Elsass-Lothringen an Frankreich, Posen und Westpreußen an Polen, alle Kolonien) und sein Heer auf <strong>100.000 Mann</strong> verkleinern. Viele Deutsche nannten ihn „Schandfrieden“ oder „Diktat“ – eine schwere Hypothek für die <strong>Weimarer Republik</strong>.",
          "<strong>Neue Landkarte:</strong> Vier Reiche zerfielen – das deutsche Kaiserreich, Österreich-Ungarn, das Russische Reich und das Osmanische Reich. Neue Staaten entstanden: <strong>Polen, die Tschechoslowakei, Jugoslawien</strong>, die baltischen Staaten, Finnland. In Russland herrschten nach der Revolution die Bolschewiki. Der <strong>Völkerbund</strong> (1920) sollte künftige Kriege verhindern – die USA traten ihm allerdings nicht bei.",
          "<strong>Langfristige Folgen:</strong> Frauen hatten in Fabriken Männer ersetzt und erhielten in Deutschland 1918/19 das <strong>Wahlrecht</strong>. Schulden, Inflation (1923 Hyperinflation) und Revanchismus vergifteten die Politik. Weil der Erste Weltkrieg den Boden für Faschismus, Nationalsozialismus und den Zweiten Weltkrieg bereitete, nannte ihn der Historiker George F. Kennan die <strong>„Urkatastrophe des 20. Jahrhunderts“</strong>.",
        ],
        begriffe: ["Versailler Vertrag", "Artikel 231", "Reparationen", "Gebietsverluste", "Völkerbund", "Weimarer Republik", "Zerfall der Vielvölkerreiche", "neue Staaten", "Frauenwahlrecht", "Urkatastrophe"],
      },
      aufgaben: [
        {
          nr: 33, typ: "mc", eyebrow: "Grundwissen", titel: "Der Versailler Vertrag",
          niveaus: {
            A: { frage: "Was legte der Versailler Vertrag von 1919 fest?", optionen: [
              { t: "Deutschland musste Gebiete abtreten, Reparationen zahlen und sein Heer stark verkleinern", ok: true },
              { t: "Deutschland erhielt neue Kolonien in Afrika", ok: false },
              { t: "Deutschland und Frankreich schlossen ein Bündnis", ok: false },
            ] },
            B: { frage: "Was besagte Artikel 231 des Versailler Vertrags?", optionen: [
              { t: "Deutschland und seine Verbündeten tragen die Verantwortung für den Krieg und alle Schäden (Kriegsschuldartikel)", ok: true },
              { t: "Deutschland darf sofort dem Völkerbund beitreten", ok: false },
              { t: "Elsass-Lothringen bleibt deutsch", ok: false },
              { t: "Der Kaiser darf nach Deutschland zurückkehren", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen erklären, warum der Vertrag die Weimarer Republik belastete?", optionen: [
              { t: "Viele Deutsche empfanden ihn als „Diktat“ und „Schandfrieden“, weil Deutschland nicht mitverhandeln durfte", ok: true },
              { t: "Die demokratischen Politiker, die ihn unterschreiben mussten, wurden von Rechtsextremen als „Erfüllungspolitiker“ angegriffen", ok: true },
              { t: "Der Vertrag erlaubte Deutschland eine Armee von fünf Millionen Mann", ok: false },
              { t: "Der Vertrag wurde 1919 von fast allen Deutschen begrüßt", ok: false },
            ] },
          },
        },
        {
          nr: 34, typ: "luecke", eyebrow: "Fachbegriffe", titel: "Ein neues Europa",
          niveaus: {
            A: { modus: "chips", ablenker: ["Monarchie", "Sieger"], text: "1919 musste Deutschland den Vertrag von [Versailles] unterschreiben. Es musste [Reparationen] an die Sieger zahlen. Aus dem Kaiserreich wurde eine [Republik]. Um künftige Kriege zu verhindern, wurde der [Völkerbund] gegründet." },
            B: { modus: "input", text: "Deutschland verlor unter anderem [Elsass-Lothringen|Elsaß-Lothringen] an Frankreich und Gebiete im Osten an das neue [Polen]. Das Heer wurde auf [100.000|100000|100 000] Mann begrenzt. Artikel [231] legte die Kriegsschuld fest. Die Vielvölkerreiche [Österreich-Ungarn|Österreich Ungarn] und das Osmanische Reich zerfielen." },
            C: { modus: "input", text: "Im Krieg starben rund [9|10|neun|zehn] Millionen Soldaten. Neue Staaten wie die [Tschechoslowakei], Polen und Jugoslawien entstanden. Vier Monarchien endeten: Hohenzollern, Habsburger, [Romanow|Romanows|Romanov] und Osmanen. In Deutschland führten Kriegsschulden und Reparationen 1923 zur [Hyperinflation|Inflation]. Die USA traten dem von Präsident Wilson vorgeschlagenen [Völkerbund] nicht bei. Der Historiker George F. Kennan nannte den Ersten Weltkrieg die [Urkatastrophe] des 20. Jahrhunderts." },
          },
        },
        {
          nr: 35, typ: "zuordnung", eyebrow: "Folgen ordnen", titel: "Welche Folge gehört in welchen Bereich?",
          niveaus: {
            A: { links: "Folge", rechts: "Bereich", paare: [
              ["Ende der Monarchie, Weimarer Republik", "Politische Folge"],
              ["Reparationen und Inflation", "Wirtschaftliche Folge"],
              ["Millionen Tote und Kriegsversehrte", "Gesellschaftliche Folge"],
            ] },
            B: { links: "Folge", rechts: "Bereich", paare: [
              ["Ende der Monarchie, Weimarer Republik", "Politische Folge"],
              ["Reparationen und Inflation", "Wirtschaftliche Folge"],
              ["Millionen Tote und Kriegsversehrte", "Gesellschaftliche Folge"],
              ["Verlust von Elsass-Lothringen und der Kolonien", "Territoriale Folge"],
            ] },
            C: { links: "Folge", rechts: "Bereich", paare: [
              ["Vier Monarchien enden, neue Republiken entstehen", "Politische Folge"],
              ["Reparationen, Kriegsschulden und Hyperinflation 1923", "Wirtschaftliche Folge"],
              ["Kriegsversehrte, Frauenwahlrecht, „verlorene Generation“", "Gesellschaftliche Folge"],
              ["Gebietsverluste Deutschlands, neue Staaten in Ostmitteleuropa", "Territoriale Folge"],
              ["Gründung des Völkerbunds, USA werden zur Weltmacht", "Internationale Folge"],
            ] },
          },
        },
        {
          nr: 36, typ: "diagramm", eyebrow: "Diagramm auswerten", titel: "Was Deutschland verlor",
          chart: {
            typ: "bar", horizontal: true, einheit: "%", yTitel: "Verlust in Prozent des Bestands von 1914",
            quelle: "Gerundete Werte zu den Bestimmungen des Versailler Vertrags. Tippe auf einen Balken.",
            labels: ["Staatsgebiet", "Bevölkerung", "Steinkohleförderung", "Eisenerzvorkommen", "Kolonien"],
            datasets: [{ label: "Verlust in %", data: [13, 10, 26, 75, 100], farbe: "#AD007C" }],
          },
          niveaus: {
            A: { frage: "Welchen Anteil seiner Fläche verlor Deutschland durch den Versailler Vertrag?", optionen: [
              { t: "Etwa 13 Prozent", ok: true }, { t: "Etwa 75 Prozent", ok: false }, { t: "Gar nichts", ok: false },
            ] },
            B: { frage: "Welche Folge hatte der Verlust von rund 75 Prozent der Eisenerzvorkommen (vor allem in Lothringen)?", optionen: [
              { t: "Die Stahl- und Rüstungsindustrie wurde geschwächt, Deutschland wurde von Importen abhängig", ok: true },
              { t: "Deutschland hatte danach mehr Eisen als je zuvor", ok: false },
              { t: "Die Landwirtschaft brach zusammen", ok: false },
              { t: "Der Verlust hatte keine Auswirkungen", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen sind sachlich richtig?", optionen: [
              { t: "Deutschland blieb trotz der Verluste ein großer Staat – 87 Prozent des Gebiets und 90 Prozent der Bevölkerung blieben erhalten", ok: true },
              { t: "Die Rohstoffverluste wogen wirtschaftlich schwerer als der Flächenverlust – das erklärt einen Teil der Empörung", ok: true },
              { t: "Deutschland verlor über die Hälfte seiner Bevölkerung", ok: false },
              { t: "Das Diagramm zeigt die Verluste Frankreichs", ok: false },
            ] },
          },
        },
        {
          nr: 37, typ: "sortierung", eyebrow: "Zeitliche Ordnung", titel: "Nach dem Krieg",
          niveaus: {
            A: { hinweis: "Drei Daten nach dem Krieg.", items: [
              "11. November 1918 · Waffenstillstand",
              "28. Juni 1919 · Unterzeichnung des Versailler Vertrags",
              "Januar 1920 · Der Völkerbund nimmt seine Arbeit auf",
            ] },
            B: { hinweis: "Fünf Schritte ohne Datum.", items: [
              "Waffenstillstand von Compiègne",
              "Beginn der Pariser Friedenskonferenz",
              "Unterzeichnung des Versailler Vertrags",
              "Die Weimarer Verfassung tritt in Kraft",
              "Der Völkerbund nimmt seine Arbeit auf",
            ] },
            C: { hinweis: "Sieben Schritte ohne Datum – bis zur Krise von 1923.", items: [
              "Waffenstillstand von Compiègne",
              "Wahl zur Weimarer Nationalversammlung",
              "Unterzeichnung des Versailler Vertrags",
              "Die Weimarer Verfassung tritt in Kraft",
              "Der Völkerbund nimmt seine Arbeit auf",
              "Die Reparationssumme wird auf 132 Milliarden Goldmark festgelegt",
              "Ruhrbesetzung und Hyperinflation",
            ] },
          },
        },
        {
          nr: 38, typ: "karte", eyebrow: "Karte erkunden", titel: "Europa nach 1919", karte: "europa1920",
          benoetigt: { A: 3, B: 6, C: 10 },
          niveaus: {
            A: { frage: "Welcher Staat entstand 1918 neu aus Teilen Österreich-Ungarns?", optionen: [
              { t: "Die Tschechoslowakei", ok: true }, { t: "Frankreich", ok: false }, { t: "Das Osmanische Reich", ok: false },
            ] },
            B: { frage: "Was war der „Polnische Korridor“?", optionen: [
              { t: "Ein Gebiet Westpreußens, das Polen den Zugang zur Ostsee gab und Ostpreußen vom übrigen Reich trennte", ok: true },
              { t: "Eine Eisenbahnlinie von Berlin nach Warschau", ok: false },
              { t: "Ein Grenzstreifen zwischen Polen und Russland", ok: false },
              { t: "Ein Fluss in Schlesien", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Probleme der Neuordnung zeigt die Karte?", optionen: [
              { t: "In den neuen Staaten lebten große Minderheiten (z. B. Deutsche in der Tschechoslowakei) – das Selbstbestimmungsrecht wurde nicht überall verwirklicht", ok: true },
              { t: "Gebietsverluste wie Danzig und der Korridor wurden in Deutschland als Unrecht empfunden und später von den Nationalsozialisten ausgenutzt", ok: true },
              { t: "Österreich-Ungarn wurde 1919 vergrößert", ok: false },
              { t: "Russland gewann durch den Krieg das Baltikum und Finnland hinzu", ok: false },
            ] },
          },
        },
        {
          nr: 39, typ: "freitext", eyebrow: "Beurteilen", titel: "Schandfrieden oder gerechter Frieden?",
          kontext: "Klasse 9 Geschichte, Abschnitt Folgen. Begriffe: Versailler Vertrag, Artikel 231, Reparationen, Gebietsverluste, Völkerbund, Weimarer Republik, Revanchismus, Sicherheitsbedürfnis Frankreichs.",
          niveaus: {
            A: { aufgabe: "Nenne drei Folgen des Ersten Weltkriegs und erkläre eine davon genauer.", starter: ["Eine Folge war …", "Das bedeutete, dass …", "Eine weitere Folge …"], begriffe: ["Versailler Vertrag", "Republik", "Tote"], min: 60 },
            B: { aufgabe: "Erkläre, warum der Versailler Vertrag in Deutschland als „Schandfrieden“ empfunden wurde – und was die Siegermächte mit ihm erreichen wollten.", begriffe: ["Artikel 231", "Reparationen", "Gebietsverluste", "Sicherheit", "Diktat"], min: 100 },
            C: { aufgabe: "Beurteile: War der Versailler Vertrag zu hart, zu mild oder angemessen? Wäge Argumente beider Seiten ab (z. B. das Sicherheitsbedürfnis Frankreichs, die Zerstörungen in Nordfrankreich, den Frieden von Brest-Litowsk als Vergleich) und beziehe die langfristigen Folgen ein.", begriffe: ["Versailler Vertrag", "Brest-Litowsk", "Reparationen", "Weimarer Republik", "Revanchismus"], min: 150 },
          },
        },
        {
          nr: 40, typ: "notizen", eyebrow: "Recherche", titel: "Meine Stichpunkte: Folgen", abschnitt: "folgen",
          hinweis: "Ordne deine Stichpunkte nach Bereichen (politisch, territorial, wirtschaftlich, gesellschaftlich) oder nach Zeit.",
          kiFrage: "Prüfe diese Recherche-Stichpunkte zu den Folgen des Ersten Weltkriegs (Versailler Vertrag, neue Staaten, Weimarer Republik, Völkerbund) auf sachliche Richtigkeit und Vollständigkeit.",
        },
      ],
    },

    // ════════════════════════════════ ABSCHLUSS ════════════════════════
    {
      key: "abschluss", label: "Zeitstrahl & Quellen", icon: "📚", kurz: "Z",
      intro: {
        eyebrow: "Abschluss", titel: "Alles in zeitlicher Ordnung – und mit verlässlichen Quellen",
        absaetze: [
          "Auf dem Original-Arbeitsblatt sollst du auf eine <strong>sinnvolle zeitliche Ordnung</strong> achten und <strong>mindestens zwei verlässliche Quellen</strong> nutzen und notieren. Genau das prüfst du hier: Zuerst ordnest du den gesamten Krieg auf einem Zeitstrahl, dann zeigst du, dass du verlässliche von unzuverlässigen Quellen unterscheiden kannst, und schließlich trägst du deine eigenen Quellen ein.",
          "<strong>Verlässliche Quellen für dieses Thema:</strong> dein Geschichtsbuch, die Bundeszentrale für politische Bildung (bpb.de), das Lebendige Museum Online des Deutschen Historischen Museums (dhm.de/lemo), Planet Wissen (planet-wissen.de) sowie Dokumentationen von ARD und ZDF. Wikipedia eignet sich zum Einstieg – prüfe wichtige Angaben aber über die dort angegebenen Belege oder eine zweite Quelle. KI-Chatbots können Fakten und Quellen erfinden.",
        ],
        begriffe: ["Zeitstrahl", "Quellenkritik", "verlässliche Quelle", "Beleg", "Urkatastrophe"],
      },
      aufgaben: [
        {
          nr: 41, typ: "sortierung", eyebrow: "Gesamtüberblick", titel: "Der große Zeitstrahl 1914–1919",
          niveaus: {
            A: { hinweis: "Vier Stationen mit Datum.", items: [
              "Juni 1914 · Attentat von Sarajevo",
              "September 1914 · Marneschlacht",
              "April 1917 · Kriegseintritt der USA",
              "November 1918 · Waffenstillstand",
            ] },
            B: { hinweis: "Sechs Stationen ohne Datum.", items: [
              "Attentat von Sarajevo",
              "Marneschlacht – Beginn des Stellungskriegs",
              "Schlacht um Verdun",
              "Kriegseintritt der USA",
              "Novemberrevolution und Waffenstillstand",
              "Versailler Vertrag",
            ] },
            C: { hinweis: "Neun Stationen ohne Datum – vom Attentat bis Versailles.", items: [
              "Attentat von Sarajevo",
              "Österreich-Ungarn erklärt Serbien den Krieg",
              "Marneschlacht – Beginn des Stellungskriegs",
              "Erster Giftgaseinsatz bei Ypern",
              "Schlacht um Verdun",
              "Kriegseintritt der USA",
              "Frieden von Brest-Litowsk",
              "Waffenstillstand von Compiègne",
              "Unterzeichnung des Versailler Vertrags",
            ] },
          },
        },
        {
          nr: 42, typ: "mc", eyebrow: "Quellenkritik", titel: "Verlässliche Quellen erkennen",
          niveaus: {
            A: { frage: "Welche Quelle ist für deine Recherche am verlässlichsten?", optionen: [
              { t: "Das Online-Angebot der Bundeszentrale für politische Bildung (bpb.de)", ok: true },
              { t: "Ein anonymer Kommentar unter einem Video", ok: false },
              { t: "Ein Meme mit einem Zitat ohne Angabe der Herkunft", ok: false },
            ] },
            B: { frage: "Woran erkennst du eine verlässliche Internetquelle?", optionen: [
              { t: "Autor oder Institution sind erkennbar, Angaben sind belegt, das Datum ist genannt und die Seite verfolgt kein Werbe- oder Propagandaziel", ok: true },
              { t: "Sie hat besonders viele Likes und Kommentare", ok: false },
              { t: "Sie steht ganz oben in der Suchmaschine", ok: false },
              { t: "Sie ist besonders bunt und modern gestaltet", ok: false },
            ] },
            C: { multi: 2, frage: "Welche ZWEI Aussagen zum Umgang mit Wikipedia und KI-Chatbots stimmen?", optionen: [
              { t: "Wikipedia eignet sich zum Einstieg; wichtige Angaben sollte man über die dort angegebenen Belege oder eine zweite Quelle prüfen", ok: true },
              { t: "KI-Chatbots können Fakten und Quellen erfinden – ihre Angaben müssen immer gegengeprüft werden", ok: true },
              { t: "Was ein KI-Chatbot sagt, ist automatisch richtig, weil er auf viele Daten zugreift", ok: false },
              { t: "Wikipedia darf man in der Schule grundsätzlich nicht nutzen", ok: false },
            ] },
          },
        },
        {
          nr: 43, typ: "quellen", eyebrow: "Quellenverzeichnis", titel: "Meine Quellen",
          hinweis: "Trage mindestens zwei verlässliche Quellen ein, die du für deine Stichpunkte genutzt hast, und begründe kurz, warum du sie für verlässlich hältst.",
          min: 2,
        },
        {
          nr: "T", typ: "transfer", eyebrow: "Transfer · Beurteilen", titel: "Urkatastrophe des 20. Jahrhunderts?",
          kontext: "Klasse 9 Geschichte, Transferaufgabe zum gesamten Arbeitsblatt. Begriffe: Ursachen, Auslöser, Verlauf, Kriegsende, Folgen, Versailler Vertrag, Weimarer Republik, Zweiter Weltkrieg, George F. Kennan.",
          aufgabe: "Der Historiker George F. Kennan nannte den Ersten Weltkrieg die „Urkatastrophe des 20. Jahrhunderts“. Erkläre, was er damit gemeint haben könnte, und beurteile, ob du ihm zustimmst. Beziehe Ursachen, Verlauf und Folgen ein und achte auf eine sinnvolle zeitliche Ordnung.",
          begriffe: ["Ursachen", "Verlauf", "Folgen", "Versailler Vertrag", "Weimarer Republik", "Zweiter Weltkrieg"],
          min: 200,
        },
      ],
    },
  ],
};
