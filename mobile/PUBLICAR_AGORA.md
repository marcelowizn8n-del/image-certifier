# 🚀 Publicar Image Certifier nas Lojas

## Pré-requisitos ✅
- [x] Conta Expo (expo.dev)
- [x] Conta Apple Developer ($99/ano)
- [x] Conta Google Play Developer ($25)
- [x] Ícones do app (já gerados)
- [x] API configurada (https://www.imgcertifier.app)

---

## PASSO 1: Baixar o Projeto

### Opção A: Baixar como ZIP
1. No Replit, clique nos 3 pontos no topo direito
2. Clique em "Download as ZIP"
3. Extraia a pasta `mobile` do ZIP

### Opção B: Clonar com Git
```bash
# Clone o repositório do Replit
git clone <seu-replit-url>
cd <pasta>/mobile
```

---

## PASSO 2: Configurar no seu Computador

### Instalar dependências
```bash
cd mobile
npm install
```

### Instalar EAS CLI globalmente
```bash
npm install -g eas-cli
```

### Fazer login no Expo
```bash
npx eas-cli login
# Digite seu email e senha do Expo
```

### Vincular ao projeto Expo
```bash
npx eas-cli init
# Isso vai criar o projeto no expo.dev e atualizar app.json
```

---

## PASSO 3: Configurar eas.json

Edite o arquivo `eas.json` e substitua:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "SEU_EMAIL_APPLE@exemplo.com",
        "ascAppId": "SEU_APP_ID_DO_APP_STORE_CONNECT"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal"
      }
    }
  }
}
```

### Onde encontrar o ascAppId:
1. Vá em https://appstoreconnect.apple.com
2. Crie um novo app ou selecione existente
3. O ID está na URL: `https://appstoreconnect.apple.com/apps/XXXXXXXXX`

### Onde obter google-services.json:
1. Vá em https://play.google.com/console
2. Configurações > API Access > Create Service Account
3. Baixe o JSON e coloque na pasta `mobile/`

---

## PASSO 4: Build para iOS (App Store)

### Criar o build
```bash
npx eas-cli build --platform ios --profile production
```

Este comando vai:
- Compilar seu app na nuvem do Expo
- Pedir credenciais Apple (login Apple ID)
- Criar o arquivo .ipa assinado

### Enviar para App Store Connect
```bash
npx eas-cli submit --platform ios
```

### No App Store Connect:
1. Vá em https://appstoreconnect.apple.com
2. Seu app aparecerá em "TestFlight" primeiro
3. Adicione informações:
   - Descrição do app
   - Screenshots (veja seção "Screenshots Obrigatórios" abaixo)
   - URL de privacidade: https://www.imgcertifier.app/privacy
4. Submeta para revisão

---

## 📱 Screenshots Obrigatórios

### iOS (App Store):
Você precisa de screenshots para cada tamanho de tela:

| Dispositivo | Tamanho (pixels) |
|------------|------------------|
| iPhone 6.7" (14 Pro Max) | 1290 x 2796 |
| iPhone 6.5" (11 Pro Max) | 1242 x 2688 |
| iPhone 5.5" (8 Plus) | 1242 x 2208 |
| iPad Pro 12.9" | 2048 x 2732 |

**Como capturar:**
1. Instale o app via TestFlight
2. Navegue até cada tela importante
3. Capture screenshots (Volume + Power)
4. Ou use o Simulador Xcode (Cmd + S)

### Android (Google Play):
| Tipo | Tamanho (pixels) |
|------|------------------|
| Screenshots Phone | 1080 x 1920 (mín 2, máx 8) |
| Feature Graphic | 1024 x 500 |
| Ícone | 512 x 512 |

**Telas recomendadas para capturar:**
1. Tela inicial (upload de imagem)
2. Resultado da análise (mostrando Original)
3. Resultado da análise (mostrando AI Generated)
4. Histórico de análises
5. Configurações (idiomas)

---

## PASSO 5: Build para Android (Google Play)

### Criar o build
```bash
npx eas-cli build --platform android --profile production
```

Este comando vai:
- Compilar seu app na nuvem
- Gerar arquivo .aab (Android App Bundle)

### Enviar para Google Play
```bash
npx eas-cli submit --platform android
```

### No Google Play Console:
1. Vá em https://play.google.com/console
2. Crie um novo app
3. Adicione informações:
   - Descrição do app
   - Screenshots
   - Ícone (já incluído no build)
   - URL de privacidade: https://www.imgcertifier.app/privacy
4. Preencha o questionário de classificação de conteúdo
5. Submeta para revisão

---

## 📝 Informações para as Lojas

### Descrição do App (copie e cole):

**Português:**
```
Image Certifier - Detecte imagens geradas por IA

Descubra se uma imagem é autêntica ou criada por inteligência artificial. 
Faça upload de fotos, cole URLs ou use a câmera para análise instantânea.

✓ Detecção de imagens AI (Midjourney, DALL-E, Stable Diffusion)
✓ Análise de metadados EXIF
✓ Suporte a 6 idiomas
✓ 10 análises gratuitas

Combata fake news e desinformação verificando a autenticidade das imagens.
```

**English:**
```
Image Certifier - Detect AI-Generated Images

Discover if an image is authentic or created by artificial intelligence.
Upload photos, paste URLs, or use your camera for instant analysis.

✓ AI image detection (Midjourney, DALL-E, Stable Diffusion)
✓ EXIF metadata analysis
✓ 6 language support
✓ 10 free analyses

Combat fake news and misinformation by verifying image authenticity.
```

### Palavras-chave:
`AI detection, fake image, image verification, deepfake, AI generated, photo analysis`

### Categoria:
- iOS: Utilities ou Photo & Video
- Android: Tools ou Photography

---

## ⏱️ Tempo Estimado

| Etapa | Tempo |
|-------|-------|
| Configuração inicial | 15 min |
| Build iOS | 20-40 min |
| Build Android | 15-30 min |
| Preencher informações | 30 min |
| Revisão Apple | 1-3 dias |
| Revisão Google | 1-7 dias |

---

## 🆘 Problemas Comuns

### Build falha
```bash
# Limpar cache e tentar novamente
npx eas-cli build --clear-cache --platform ios
```

### Credenciais Apple
- Certifique-se de ter 2FA ativado
- Use App-Specific Password se necessário

### Submissão rejeitada
- Verifique se a política de privacidade está acessível
- Adicione screenshots de todas as funcionalidades
- Responda perguntas sobre uso de câmera

---

## ✅ Checklist Final

- [ ] Baixei o projeto do Replit
- [ ] Instalei dependências (`npm install`)
- [ ] Fiz login no EAS (`npx eas-cli login`)
- [ ] Configurei eas.json com minhas credenciais
- [ ] Criei build iOS
- [ ] Enviei para App Store Connect
- [ ] Criei build Android
- [ ] Enviei para Google Play Console
- [ ] Preenchi informações nas duas lojas
- [ ] Submeti para revisão

🎉 **Parabéns! Seu app será publicado em breve!**
