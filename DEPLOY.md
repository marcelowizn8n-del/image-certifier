# Image Certifier Deployment Guide (EasyPanel)

This guide explains how to set up the reverse proxy and SSL for `imgcertifier.app` using EasyPanel.

## 1. Cleanup Manual Nginx

To avoid conflicts with EasyPanel, run these commands to stop and disable the manual Nginx service:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo rm /etc/nginx/sites-enabled/imgcertifier
```

## 2. Configure EasyPanel

1. Login to your **EasyPanel** dashboard.
2. Select your project and the application for Image Certifier.
3. Go to the **Domains** tab.
4. Add your domain: `imgcertifier.app`.
5. Ensure the **Port** is set to `5000` (the port your app is running on).
6. EasyPanel will automatically request and install the SSL certificate via Let's Encrypt.

## 3. Verify

- Wait a few minutes for the DNS and SSL to propagate.
- Visit `https://imgcertifier.app` in your browser.
- It should now load correctly with a valid SSL certificate.

## Troubleshooting

### ERR_SSL_PROTOCOL_ERROR
This error usually means the SSL handshake failed. Common causes:

1.  **Cloudflare Mode**: If you are using Cloudflare, ensure your SSL/TLS mode is set to **Full** or **Full (Strict)**.
    *   If set to "Flexible", Cloudflare talks HTTP to your server, but your server might be redirecting to HTTPS, causing a loop or protocol error.
    *   If set to "Off", you can't access via HTTPS.

2.  **EasyPanel Certificate**:
    *   Check if the certificate is actually issued in EasyPanel > Project > App > Domains.
    *   It should say "Active" or show a lock icon.
    *   If it's "Pending" for a long time, check if your DNS points to the correct IP.

3.  **Port Mismatch**:
    *   Ensure the "App Service Port" in EasyPanel is `5000`.
    *   If EasyPanel routes to port 80 but your app listens on 5000, it won't work.

4.  **Mixed Content**:
    *   Ensure all your frontend requests use relative paths (e.g., `/api/...`) or the `https://` variable, not hardcoded `http://`.

### 502 Bad Gateway
*   User-side: The server is down or restarting.
*   Admin-side: Check logs. The app might have crashed.

### 504 Gateway Timeout
*   The app took too long to respond. Check for infinite loops or slow database queries.

