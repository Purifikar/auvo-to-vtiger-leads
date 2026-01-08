# helpers/

## 🎯 Objetivo
Funções utilitárias para transformação de dados: conversão de datas para formato Auvo e geocoding reverso via Google Maps API.

## 📂 Arquivos Principais
- `index.ts`: Reexporta todos os helpers
- `dateHelper.ts`: Conversão de timestamps ISO para {dateStart, dateEnd}
- `googleMapsHelper.ts`: Geocoding reverso + parsing de endereços

## 🔄 Fluxo de Dados e Dependências
- **Entrada (dateHelper):** `SyncInput { timestamp }` - ISO 8601
- **Saída (dateHelper):** `DateRange { dateStart, dateEnd }` - yyyy-MM-dd
- **Entrada (googleMapsHelper):** Latitude/Longitude
- **Saída (googleMapsHelper):** `VtigerAddress` com campos cf_xxx mapeados
- **Dependências:**
  - `luxon` - Manipulação de datas com timezone
  - `GOOGLE_MAPS_API_KEY` - Variável de ambiente

## ⚠️ Regras e Padrões

### dateHelper:
- **Timezone:** Sempre usar `America/Sao_Paulo`
- `dateEnd` = data do timestamp (hoje)
- `dateStart` = dateEnd - 1 dia (ontem)
- Formato de saída: `yyyy-MM-dd`

### googleMapsHelper:
- **Validação:** Coordenadas devem ser válidas (-90 a 90, -180 a 180)
- **Tratamento de erro:** Não quebrar se geocoding falhar, retornar campos vazios
- **Mapeamento de campos:**
  | Google Component | Campo Vtiger |
  |-----------------|--------------|
  | route | cf_995 (Logradouro) |
  | street_number | cf_763 (Número) |
  | sublocality_level_1 | cf_767 (Bairro) |
  | administrative_area_level_2 | city / cf_993 |
  | administrative_area_level_1 | state / cf_977 |
  | postal_code | code (CEP) |
