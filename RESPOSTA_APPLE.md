# App Store Connect - Suggested Reply to Apple Review

Use the text below in the Resolution Center (you can adapt app/version details if needed).

---

**Dear App Store Review Team,**

Thank you for the feedback. We implemented changes to address all cited items.

## 1) Guideline 1.1 - Safety / Objectionable Content

We updated App Store metadata to remove wording that could imply objectionable content. We now use neutral, technical language focused on image authenticity verification and content integrity.

Updated fields include promotional text, keywords, and marketing copy.

## 2) Guidelines 5.1.1(i) and 5.1.2(i) - Privacy / AI data sharing

Before any analysis request is sent, the iOS app now shows a dedicated consent modal that clearly discloses:

- what data is sent (image or image URL, file details, and available technical metadata such as EXIF),
- who receives data (Image Certifier backend and third-party AI providers OpenAI and Sightengine),
- purpose of processing (image authenticity analysis only),
- explicit user action required to proceed ("I Agree"),
- privacy policy link,
- ability to revoke consent later in Settings.

If the user does not consent, analysis is not sent.

We also updated our privacy policy to explicitly describe collection, processing, sharing, and retention.

## 3) Guideline 3.1.1 - In-App Purchase

Paid digital functionality is available for purchase in iOS via Apple In-App Purchase subscriptions in-app. The iOS app supports purchase and restore flows through StoreKit.

## 4) Guideline 2.1 - Information needed about face data

Below are complete answers to the requested questions:

1. **What face data does the app collect?**  
   The app may process facial visual characteristics present in submitted images (for example: facial geometry/proportions, landmarks, skin texture, and lighting consistency signals) as part of authenticity analysis.

2. **Planned uses of face data**  
   Face-related visual signals are used only to generate an authenticity result requested by the user. They are not used for identity verification, recognition, profiling, advertising, or unrelated analytics.

3. **Will face data be shared with third parties? Where stored?**  
   For analysis delivery, submitted image data and required technical metadata may be processed by our backend and third-party AI providers (OpenAI and Sightengine) over encrypted HTTPS/TLS channels. We do not sell/share data for marketing.

4. **How long is face data retained?**  
   Face-related derived data is processed in real time and is not stored separately after analysis. Analysis outcomes are retained in the user's account history until deleted by the user. Account deletion removes associated data according to policy timelines.

5. **Where is this explained in privacy policy?**  
   It is described in these sections:
   - "2. Face and Biometric Data"
   - "4. Third-Party Services"
   - "5. Data Retention"

6. **Specific policy text (quoted)**
   - "To detect possible synthetic manipulation in an image, our system may analyze facial visual characteristics present in the submitted image..."
   - "When you authorize analysis, submitted image/URL and required technical metadata may be sent to these providers over encrypted connections (HTTPS/TLS), strictly to deliver the authenticity analysis you requested."
   - "Derived face-related data: not stored separately after analysis."

If needed, we can provide exact steps to reproduce the consent flow in-app.

Thank you for your re-review.

**Best regards,**  
**Image Certifier Team**
