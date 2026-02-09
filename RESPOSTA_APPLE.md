# Resposta para a Apple (App Store Connect)

Você pode enviar esta mensagem através do App Store Connect, no centro de resoluções ou como uma nota de revisão.

---

**Dear App Store Review Team,**

We have addressed the issues cited in the latest review regarding Guidelines 1.1 (Safety), 3.1.1 (Payments), and 2.1 (Privacy). Below is a summary of the changes implemented:

### 1. Safety & Objectionable Content (Guideline 1.1)
We have thoroughly revised the app's metadata, keywords, and in-app content. We have transitioned away from terms such as "Deepfake" and "Fake News," replacing them with technical, neutral terminology: **"Synthetic Content Analysis"** and **"Digital Authenticity Verification."** This shift ensures the platform focusing on technical media certification rather than the generation or promotion of objectionable content.

### 2. Payments - In-App Purchase (Guideline 3.1.1)
We have fully integrated **In-App Purchases (IAP)** for all digital services and premium subscriptions within the iOS app. Users can now securely subscribe directly through the App Store. Our backend now includes a dedicated verification service to validate Apple receipts before granting access to premium features.

### 3. Privacy - Face Data Disclosure (Guideline 2.1)
We have updated our Privacy Policy and in-app disclosures to provide explicit transparency regarding the use of facial analysis:
- **Data Collection**: The app analyzes facial landmarks and geometry from uploaded media solely to detect patterns of AI generation or digital manipulation.
- **Usage**: This data is used exclusively to generate an "Authenticity Score" for the user.
- **Sharing**: Processing is performed via secure API channels (OpenAI) that comply with non-training privacy standards. No data is shared with third parties for marketing or other purposes.
- **Retention**: Data is stored only within the user's private analysis history and is deleted if the user deletes their account or history.

Our updated Privacy Policy can be found at: [https://www.imgcertifier.app/privacy](https://www.imgcertifier.app/privacy) (ou o link atualizado do seu site).

We believe these changes bring the app into full compliance with the App Store Review Guidelines and look forward to your positive review.

**Best regards,**
**Image Certifier Team**
