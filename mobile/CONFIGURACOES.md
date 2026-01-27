# Configurações do Image Certifier

## Hospedagem da API (Backend)

| Campo | Valor |
|-------|-------|
| **URL** | `https://www.imgcertifier.app` |
| **Plataforma** | Replit |
| **Domínio customizado** | imgcertifier.app |

---

## Configurações do App Mobile

### Informações Gerais

| Campo | Valor |
|-------|-------|
| **Nome** | Image Certifier |
| **Slug** | image-certifier |
| **Versão** | 1.0.0 |
| **Scheme (deep link)** | `imgcertifier://` |
| **Cor de fundo** | #0a0a0f |
| **Cor principal** | #00d4ff (cyan) |

### iOS

| Campo | Valor |
|-------|-------|
| **Bundle Identifier** | `app.imgcertifier.mobile` |
| **Build Number** | 1 |
| **Suporta iPad** | Sim |
| **Orientação** | Portrait |

### Android

| Campo | Valor |
|-------|-------|
| **Package Name** | `app.imgcertifier.mobile` |
| **Version Code** | 1 |
| **Ícone adaptativo** | Sim |

---

## Endpoints da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/analyze` | POST | Analisar imagem (base64) |
| `/api/analyze-url` | POST | Analisar imagem por URL |
| `/api/analyses` | GET | Histórico de análises |
| `/api/usage` | GET | Verificar limite de análises gratuitas |
| `/api/youtube-thumbnail/:videoId` | GET | Proxy para thumbnails do YouTube |

### Exemplo de Requisição - Analisar Imagem

```bash
curl -X POST https://www.imgcertifier.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ..."}'
```

### Exemplo de Resposta

```json
{
  "id": 123,
  "result": "original",
  "confidence": 92.5,
  "artifacts": {
    "textureAnomalies": false,
    "lightingInconsistencies": false,
    "anatomicalIssues": false
  },
  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "jpeg",
    "hasExif": true,
    "cameraMake": "Apple",
    "cameraModel": "iPhone 14 Pro"
  }
}
```

---

## Permissões do App

### iOS (Info.plist)

| Permissão | Chave | Descrição |
|-----------|-------|-----------|
| Câmera | `NSCameraUsageDescription` | Image Certifier needs camera access to capture images for AI analysis |
| Galeria (Leitura) | `NSPhotoLibraryUsageDescription` | Image Certifier needs photo library access to select images for AI analysis |
| Galeria (Escrita) | `NSPhotoLibraryAddUsageDescription` | Image Certifier needs access to save certified images to your photo library |

### Android (Permissions)

| Permissão | Descrição |
|-----------|-----------|
| `CAMERA` | Acesso à câmera |
| `READ_EXTERNAL_STORAGE` | Leitura de arquivos |
| `WRITE_EXTERNAL_STORAGE` | Escrita de arquivos |

---

## Idiomas Suportados

| Código | Idioma |
|--------|--------|
| PT | Português |
| EN | English |
| ES | Español |
| FR | Français |
| DE | Deutsch |
| ZH | 中文 |

---

## Arquivos de Configuração

| Arquivo | Descrição |
|---------|-----------|
| `app.json` | Configurações do Expo (nome, ícones, permissões) |
| `eas.json` | Configurações de build e submissão |
| `src/lib/api.ts` | Cliente da API (endpoints) |
| `src/lib/i18n.ts` | Traduções (6 idiomas) |
| `src/contexts/ThemeContext.tsx` | Tema escuro/claro |
| `src/contexts/LanguageContext.tsx` | Idioma selecionado |

---

## URLs Importantes

| Recurso | URL |
|---------|-----|
| **App Web** | https://www.imgcertifier.app |
| **Política de Privacidade** | https://www.imgcertifier.app/privacy |
| **Termos de Uso** | https://www.imgcertifier.app/terms |
| **Sobre** | https://www.imgcertifier.app/about |
| **Admin** | https://www.imgcertifier.app/admin |

---

## Monetização

| Modelo | Descrição |
|--------|-----------|
| **Freemium** | 10 análises gratuitas por usuário |
| **Web** | Planos Stripe (Básico, Premium, Empresarial) |
| **Mobile** | Sem monetização in-app (usa web para upgrade) |

---

## Contato

| Campo | Valor |
|-------|-------|
| **Desenvolvedor** | MFA Developer |
| **Email** | marciofa@gmail.com |
