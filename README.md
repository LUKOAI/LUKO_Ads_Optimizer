# LUKO AMZ Ads Optimizer V0.60

**Kompleksowe narzędzie do analizy i optymalizacji kampanii Amazon Advertising (PPC)**

---

## Co to jest LUKO Ads Optimizer?

LUKO Ads Optimizer to zaawansowany system do optymalizacji reklam Amazon, działający jako dodatek do Google Sheets. Automatyzuje analizę kampanii Sponsored Products, Sponsored Brands i Sponsored Display, pomagając:

- Identyfikować nierentowne targety (słowa kluczowe, produkty)
- Znajdować okazje do skalowania zyskownych kampanii
- Generować gotowe pliki BULK do importu do Amazon Ads
- Oszczędzać budżet reklamowy poprzez eliminację strat

---

## Szybki Start

### KROK 1: ZAIMPORTUJ DANE

1. Zaloguj się do **Amazon Advertising Console**
2. Pobierz raporty (ostatnie 30 dni):
   - `Campaign Report` - raport wydajności kampanii
   - `Search Term Report` - raport wyszukiwanych fraz
3. Wklej dane do odpowiednich arkuszy:
   - `Sponsored_Products_Search_term` - raport Amazon Ads
   - `SP_Bulk_Report` - eksport z Bulk Operations

> **UWAGA:** NIE usuwaj nagłówków kolumn! Wklejaj dane od wiersza 2.

### KROK 2: SKONFIGURUJ PROGI

1. Menu: `LUKO ANALYZER V6.1` → `Ustawienia ACOS`
2. Ustaw progi ACOS:
   - **Break-Even ACOS** - próg rentowności (domyślnie 25%)
   - **Niski ACOS** - doskonały wynik (domyślnie 12.5%)
   - **Wysoki ACOS** - próg alarmowy (domyślnie 40%)

### KROK 3: URUCHOM ANALIZĘ

Menu: `LUKO ANALYZER V6.1` → `Analizy` → wybierz typ:

| Typ raportu | Opis | Czas |
|-------------|------|------|
| **Raport tekstowy** | Szybkie podsumowanie tekstowe | 10-15s |
| **Pełna analiza** | Szczegółowy raport z tabelami | 15-30s |
| **Snapshot** | Kompaktowy przegląd metryk | 5-10s |

### KROK 4: GENERUJ BULK (opcjonalne)

Jeśli chcesz wprowadzić zmiany do Amazon:

1. Menu: `BULK Operations` → `1. Inicjalizuj BULK`
2. Menu: `BULK Operations` → `2. Mapowanie`
3. Menu: `BULK Operations` → `3. Analiza`
4. Przejrzyj sugestie w arkuszu `BULK_Builder`
5. Zastosuj wybrane zmiany
6. Menu: `BULK Operations` → `Eksport do Amazon`
7. Zaimportuj plik do Amazon Ads → Bulk Operations

---

## Funkcje Analizy

### Raport Tekstowy (`LUKO_Textual_Report`)
- Podsumowanie wydajności w formie tekstowej
- Status ACOS z emoji (zielony/żółty/czerwony)
- Rekomendacje optymalizacyjne
- Analiza ryzyka

### Pełna Analiza (`LUKO_Full_Analysis`)
- **Kluczowe metryki**: ACOS, ROAS, CTR, CPC, konwersja
- **Analiza rentowności**: szacowany zysk/strata
- **Segmentacja targetów**: według ACOS i wydajności
- **Analiza Pareto**: TOP targety generujące 80% sprzedaży
- **Rekomendacje**: priorytetyzowane akcje do podjęcia

### Snapshot (`LUKO_Snapshot`)
- Kompaktowy przegląd najważniejszych metryk
- Idealne do szybkiego sprawdzenia stanu kampanii

---

## System BULK Operations

### Workflow krok po kroku:

```
1. INICJALIZUJ      Przygotowanie arkuszy BULK
        ↓
2. MAPOWANIE        Kopiowanie danych z raportu Amazon
        ↓
3. ANALIZA          Automatyczna klasyfikacja targetów
        ↓
4. PRZEGLĄD         Weryfikacja sugestii w BULK_Builder
        ↓
5. ZMIANY           Zastosowanie wybranych akcji
        ↓
6. WALIDACJA        Sprawdzenie poprawności
        ↓
7. EKSPORT          Generowanie pliku do Amazon
```

### Automatyczne akcje:

| Akcja | Kolor | Opis |
|-------|-------|------|
| **PAUSE** | Czerwony | Wstrzymaj nieefektywne targety |
| **DECREASE_BID** | Pomarańczowy | Obniż stawkę (ACOS > BE) |
| **INCREASE_BID** | Zielony | Zwiększ stawkę (ACOS < 0.5×BE) |
| **MONITOR** | Szary | Za mało danych - obserwuj |
| **MAINTAIN** | Niebieski | W normie - utrzymaj |

### Progi klasyfikacji:

- **PAUSE CRITICAL**: 50+ kliknięć LUB 50€+ bez sprzedaży
- **PAUSE URGENT**: 10+ kliknięć LUB 5€+ bez sprzedaży
- **DECREASE HIGH**: ACOS > 2× Break-Even
- **DECREASE MEDIUM**: ACOS > Break-Even
- **INCREASE HIGH**: ACOS < 0.5× Break-Even + sprzedaż

---

## Obsługiwane typy raportów

| Typ raportu | Kolumny | Opis |
|-------------|---------|------|
| SP_CAMPAIGNS | ~48 | Sponsored Products - kampanie |
| SP_SEARCH_TERM | ~27 | Sponsored Products - search terms |
| SB_CAMPAIGNS | ~51 | Sponsored Brands - kampanie |
| SB_MULTI_AD_GROUP | ~68 | Sponsored Brands - multi-ad |
| SD_CAMPAIGNS | ~47 | Sponsored Display - kampanie |

---

## Wsparcie wielu języków

System automatycznie rozpoznaje nagłówki w językach:
- **EN**: English (domyślny)
- **DE**: Deutsch (niemiecki format liczb)
- **PL**: Polski
- **FR**: Français

Obsługiwane formaty liczb:
- `1,234.56` (angielski)
- `1.234,56` (niemiecki/polski)

---

## Arkusze systemowe

| Arkusz | Opis |
|--------|------|
| `Sponsored_Products_Search_term` | Wklejasz tutaj raport z Amazon |
| `SP_Bulk_Report` | Wklejasz tutaj eksport BULK |
| `BULK_Builder` | Analiza z sugestiami zmian |
| `LUKO_Textual_Report` | Raport tekstowy |
| `LUKO_Full_Analysis` | Pełna analiza |
| `LUKO_Snapshot` | Szybki przegląd |
| `LUKO_Debug_Log` | Logi debugowania |

> **UWAGA:** NIE zmieniaj nazw arkuszy systemowych!

---

## FAQ - Najczęstsze pytania

### Dlaczego ACOS pokazuje 0%?
Sprawdź czy:
- Kolumna Sales/Verkäufe zawiera dane
- Format liczb jest poprawny (niemiecki: 1.234,56)
- Nie ma pustych wierszy

### Jak zmienić próg Break-Even?
Menu → `Ustawienia ACOS` → wpisz nową wartość

### Czy moje dane są bezpieczne?
Tak! Wszystkie dane pozostają w Twoim arkuszu Google. LUKO nie wysyła danych na zewnętrzne serwery.

### Jak odświeżyć analizę?
Po wklejeniu nowych danych, ponownie uruchom wybraną analizę z menu.

### Eksport nie działa?
Upewnij się, że:
- Masz zaznaczone wiersze do eksportu (checkbox Apply)
- Kolumna `ChangesDONE` = "DONE" dla zmienionych wierszy

---

## Metryki i wzory

```
CTR = (Kliknięcia / Wyświetlenia) × 100
CPC = Wydatki / Kliknięcia
ACOS = (Wydatki / Sprzedaż) × 100
ROAS = Sprzedaż / Wydatki
Konwersja = (Zamówienia / Kliknięcia) × 100
AOV = Sprzedaż / Zamówienia
```

### Progi ACOS (domyślne):
- **Doskonały**: ≤ 12.5% (0.5× BE)
- **Dobry**: ≤ 25% (Break-Even)
- **Uwaga**: ≤ 40% (1.67× BE)
- **Krytyczny**: > 40%

---

## Wymagania

- Konto Google (Google Sheets)
- Klucz API LUKO (otrzymany po zakupie)
- Raporty z Amazon Advertising Console

---

## Kontakt i wsparcie

| | |
|---|---|
| **Email** | support@netanaliza.com |
| **Autor** | Łukasz Koronczok |
| **Firma** | NetAnaliza |
| **Wersja** | 0.60 |
| **Licencja** | Ważna do 31.12.2026 |

---

## Changelog

### V0.60 (2025-11)
- Nowe nazwy arkuszy: `Sponsored_Products_Search_term`, `SP_Bulk_Report`
- Kompatybilność wsteczna ze starymi nazwami
- ShareOfSales - udział targetu w całkowitej sprzedaży
- Ulepszona klasyfikacja targetów bez widoczności (0 kliknięć)
- Automatyczne formatowanie ACOS/CTR/ConvRate jako procenty

### V0.55 (2025-10)
- System BULK Operations z pełnym workflow
- Automatyczne kolorowanie według akcji
- Integracja z Full Analysis

### V0.50 (2025-09)
- Wspólne zasady analizy (TargetAnalysisRules)
- Analiza Pareto (20/80)
- Dynamiczne progi kliknięć

---

## Skróty klawiszowe menu

```
LUKO ANALYZER V6.1
├── Ustaw klucz API
├── Sprawdź licencję
├── Ustawienia ACOS
│
├── Analizy
│   ├── Raport tekstowy
│   ├── Pełna analiza
│   └── Snapshot
│
├── BULK Operations
│   ├── 1. Inicjalizuj BULK
│   ├── 2. Mapowanie
│   ├── 3. Analiza
│   ├── Zaznacz wszystkie
│   ├── Odznacz wszystkie
│   ├── Zaznacz według kryterium
│   ├── 4. Zastosuj zmiany
│   ├── Eksport do Amazon
│   ├── Waliduj przed eksportem
│   └── Pokaż statystyki
│
├── Debug Log
├── Wyczyść dane LUKO
├── Instrukcja
├── Pomoc
└── O programie
```

---

**LUKO Ads Optimizer** - Optymalizuj reklamy Amazon jak profesjonalista!

*© 2025 NetAnaliza - Łukasz Koronczok*
