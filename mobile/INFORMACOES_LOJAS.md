# Informações para Publicação nas Lojas

## COMANDOS EAS (executar na pasta mobile)

```bash
# 1. Instalar dependências
npm install

# 2. Instalar EAS CLI
npm install -g eas-cli

# 3. Login Expo
npx eas-cli login

# 4. Vincular projeto
npx eas-cli init

# 5. Build iOS
npx eas-cli build --platform ios --profile production

# 6. Enviar para App Store
npx eas-cli submit --platform ios

# 7. Build Android
npx eas-cli build --platform android --profile production

# 8. Enviar para Google Play
npx eas-cli submit --platform android
```

---

# APP STORE CONNECT (iOS)

## Informações Básicas

**Nome do App:**
```
Image Certifier
```

**Subtítulo:**
```
Verificação Confiável de Imagens
```

**Categoria Primária:**
```
Utilities
```

**Categoria Secundária:**
```
Photo & Video
```

**URL de Privacidade:**
```
https://imgcertifier.app/privacy
```

**URL de Suporte:**
```
https://imgcertifier.app/about
```

**Classificação Etária:**
```
4+
```

## Descrição (Português - Brasil)

```
Verifique a autenticidade de fotos e mídias digitais com o Image Certifier. 

Nossa tecnologia analisa padrões e metadados para ajudar você a identificar se uma imagem foi capturada por uma câmera real ou se contém elementos de geração sintética por inteligência artificial (IA).

RECURSOS:
• Upload de arquivos, URLs ou captura via câmera
• Análise técnica detalhada e score de confiança
• Verificação de metadados e integridade digital
• Suporte a 6 idiomas (PT, EN, ES, FR, DE, ZH)
• Interface intuitiva com modo escuro/claro
• 10 análises gratuitas iniciais

COMO FUNCIONA:
1. Selecione ou capture uma imagem
2. O sistema analisa texturas e consistência digital
3. Veja o nível de autenticidade detectado

TRANSPARÊNCIA DIGITAL:
Use o Image Certifier para ter mais clareza sobre conteúdo visual com uma análise técnica e responsável.

Desenvolvido por MFA Developer.
```

## Descrição (English - US)

```
Verify the authenticity of photos and digital media with Image Certifier. 

Our technology analyzes patterns and metadata to help you identify if an image was captured by a real camera or if it contains synthetic generation elements from artificial intelligence (AI).

FEATURES:
• Upload via file, URL, or camera capture
• Detailed technical analysis and confidence score
• Metadata and digital integrity verification
• Support for 6 languages (PT, EN, ES, FR, DE, ZH)
• Intuitive interface with dark/light mode
• 10 initial free analyses

HOW IT WORKS:
1. Select or capture an image
2. The system analyzes textures and digital consistency
3. View the detected authenticity level

DIGITAL TRANSPARENCY:
Use Image Certifier to gain more clarity about the visual content you consume. Protect your digital perception with technical verification.

Developed by MFA Developer.
```

## Palavras-chave App Store (máximo 100 caracteres)

```
image authenticity,photo verification,content integrity,digital trust,metadata analysis
```

## Novidades desta Versão

```
Versão inicial do Image Certifier.
```

## Permissões de Privacidade

**Câmera (NSCameraUsageDescription):**
```
Para capturar imagens diretamente para análise de autenticidade
```

**Biblioteca de Fotos (NSPhotoLibraryUsageDescription):**
```
Para selecionar imagens existentes para análise de autenticidade
```

---

# GOOGLE PLAY CONSOLE (Android)

## Detalhes do App

**Nome do App:**
```
Image Certifier
```

**Descrição Curta (máximo 80 caracteres):**
```
Detecte se imagens são geradas por IA ou autênticas
```

**Categoria:**
```
Tools
```

**Email de Contato:**
```
marciofa@gmail.com
```

**URL de Privacidade:**
```
https://imgcertifier.app/privacy
```

## Descrição Completa

```
Descubra se uma imagem é autêntica ou criada por inteligência artificial. 

O Image Certifier usa tecnologia avançada para analisar fotos e detectar imagens geradas por IA como Midjourney, DALL-E, Stable Diffusion e outras.

RECURSOS:
• Upload de imagens por arquivo, URL ou câmera
• Análise instantânea com resultado detalhado
• Detecção de manipulações e edições com IA
• Análise de metadados EXIF
• Suporte a 6 idiomas (PT, EN, ES, FR, DE, ZH)
• Modo escuro/claro
• 10 análises gratuitas para experimentar

COMO FUNCIONA:
1. Tire uma foto ou faça upload de uma imagem
2. O app analisa padrões, texturas e metadados
3. Receba o resultado: Original, Gerada por IA ou Modificada por IA

COMBATA FAKE NEWS:
Verifique a autenticidade de imagens antes de compartilhar. Proteja-se contra desinformação e deepfakes.

Desenvolvido por MFA Developer.
```

## Classificação de Conteúdo (Questionário IARC)

| Pergunta | Resposta |
|----------|----------|
| O app contém violência? | Não |
| O app contém linguagem imprópria? | Não |
| O app contém conteúdo sexual? | Não |
| O app promove substâncias controladas? | Não |
| O app permite conteúdo gerado por usuários visível a outros? | Não |
| O app permite compras digitais? | Sim (assinatura Premium via IAP) |
| O app compartilha localização? | Não |

**Classificação resultante:** Livre para todas as idades

## Segurança de Dados

| Pergunta | Resposta |
|----------|----------|
| O app coleta ou compartilha dados do usuário? | Sim, coleta |
| Quais dados são coletados? | Fotos (apenas para análise, não armazenadas permanentemente) |
| Os dados são compartilhados com terceiros? | Não |
| Os dados são criptografados em trânsito? | Sim (HTTPS) |
| O usuário pode solicitar exclusão dos dados? | Sim |

## Declaração de Dados Coletados

**Fotos e vídeos:**
- Coletado: Sim
- Compartilhado: Não
- Obrigatório: Sim (necessário para funcionalidade principal)
- Finalidade: Funcionalidade do app

---

# SCREENSHOTS NECESSÁRIOS

## iOS (App Store)

| Dispositivo | Tamanho |
|-------------|---------|
| iPhone 6.7" (14 Pro Max, 15 Pro Max) | 1290 x 2796 px |
| iPhone 6.5" (11 Pro Max, XS Max) | 1242 x 2688 px |
| iPhone 5.5" (8 Plus, 7 Plus) | 1242 x 2208 px |
| iPad Pro 12.9" (opcional) | 2048 x 2732 px |

## Android (Google Play)

| Tipo | Tamanho |
|------|---------|
| Screenshots (mínimo 2) | 1080 x 1920 px |
| Feature Graphic (obrigatório) | 1024 x 500 px |

## Telas para Capturar

1. **Tela inicial** - Área de upload com opções File/URL/Camera
2. **Resultado ORIGINAL** - Imagem com selo verde
3. **Resultado AI GENERATED** - Imagem com selo vermelho
4. **Histórico** - Lista de análises anteriores
5. **Configurações** - Idiomas e tema

---

# FEATURE GRAPHIC (Google Play)

Você precisa criar uma imagem promocional de 1024 x 500 pixels.

**Sugestão de design:**
- Fundo: Gradiente azul/ciano (#00d4ff para #0a0a0f)
- Logo do Image Certifier no centro
- Texto: "Detecte Imagens de IA"
- Ícones mostrando: câmera, lupa, check/x

---

# COMO TIRAR SCREENSHOTS

## Opção 1: Expo Go (mais fácil)
1. Instale "Expo Go" no iPhone/Android
2. No terminal (pasta mobile): `npx expo start`
3. Escaneie o QR code com a câmera
4. Navegue pelas telas e tire screenshots

## Opção 2: TestFlight (após build)
1. Complete o build iOS
2. Instale via TestFlight
3. Tire screenshots no dispositivo

## Opção 3: Emulador Android
1. Instale Android Studio
2. Crie um emulador Pixel 6
3. Execute: `npx expo start --android`
4. Use Ctrl+S para screenshot

---

# CHECKLIST FINAL

## App Store Connect
- [ ] Criar app no App Store Connect
- [ ] Preencher nome e subtítulo
- [ ] Selecionar categorias
- [ ] Adicionar descrição em português
- [ ] Adicionar descrição em inglês
- [ ] Adicionar palavras-chave
- [ ] Adicionar URL de privacidade
- [ ] Adicionar URL de suporte
- [ ] Configurar classificação etária (4+)
- [ ] Upload de screenshots (mínimo 3 por tamanho)
- [ ] Adicionar ícone do app
- [ ] Responder perguntas de privacidade
- [ ] Submeter para revisão

## Google Play Console
- [ ] Criar app no Play Console
- [ ] Preencher nome e descrição curta
- [ ] Adicionar descrição completa
- [ ] Selecionar categoria (Tools)
- [ ] Adicionar email de contato
- [ ] Adicionar URL de privacidade
- [ ] Upload de screenshots (mínimo 2)
- [ ] Criar e fazer upload do Feature Graphic
- [ ] Completar questionário de classificação
- [ ] Preencher seção de segurança de dados
- [ ] Submeter para revisão

---

Boa sorte com a publicação! 🚀
