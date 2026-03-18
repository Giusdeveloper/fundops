# Supabase SMTP + Email Templates (Resend)

## SMTP settings (Supabase Auth)

Enable **Custom SMTP** in Supabase:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key
- Encryption: **SSL** (port 465)
- From name: `Imment`
- From email: `noreply@fundops.it`

## Email templates (HTML)

Paste these in Supabase → Auth → Email Templates.

### Confirm signup

**Subject**
```
Conferma la tua email su FundOps
```

**Body (HTML)**
```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conferma email</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background:#E3F0FF;color:#17334F;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E3F0FF;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(23,51,79,0.16);">
            <tr>
              <td style="padding:24px 32px;background:#17334F;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.3px;color:#ffffff;">Imment</div>
                <div style="font-size:12px;opacity:0.85;color:#E3F0FF;">FundOps</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-size:22px;font-weight:700;color:#17334F;margin-bottom:8px;">
                  Conferma la tua email
                </div>
                <div style="font-size:14px;line-height:1.6;color:#335C96;">
                  Un ultimo passaggio per attivare il tuo account e accedere al flusso FundOps.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#335C96;border-radius:10px;">
                      <a href="{{ .ConfirmationURL }}"
                         style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                        Conferma email
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:12px;font-size:12px;color:#4A82BF;">
                  Il link scade automaticamente dopo un periodo di tempo.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background:#E3F0FF;"></div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 28px 32px;">
                <div style="font-size:12px;color:#4A82BF;line-height:1.5;">
                  Se il pulsante non funziona, copia e incolla questo link nel browser:
                </div>
                <div style="margin-top:6px;font-size:12px;color:#17334F;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </div>
                <div style="margin-top:12px;font-size:12px;color:#4A82BF;">
                  Se non hai richiesto questa email, puoi ignorarla.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px;background:#E3F0FF;font-size:12px;color:#17334F;">
                © Imment · FundOps
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

### Reset password

**Subject**
```
Reimposta la tua password FundOps
```

**Body (HTML)**
```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset password</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background:#E3F0FF;color:#17334F;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E3F0FF;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(23,51,79,0.16);">
            <tr>
              <td style="padding:24px 32px;background:#17334F;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.3px;color:#ffffff;">Imment</div>
                <div style="font-size:12px;opacity:0.85;color:#E3F0FF;">FundOps</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-size:22px;font-weight:700;color:#17334F;margin-bottom:8px;">
                  Reimposta la tua password
                </div>
                <div style="font-size:14px;line-height:1.6;color:#335C96;">
                  Clicca il pulsante per impostare una nuova password.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#335C96;border-radius:10px;">
                      <a href="{{ .ConfirmationURL }}"
                         style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                        Reimposta password
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:12px;font-size:12px;color:#4A82BF;">
                  Se non hai richiesto il reset, puoi ignorare questa email.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background:#E3F0FF;"></div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 28px 32px;">
                <div style="font-size:12px;color:#4A82BF;line-height:1.5;">
                  Se il pulsante non funziona, copia e incolla questo link nel browser:
                </div>
                <div style="margin-top:6px;font-size:12px;color:#17334F;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px;background:#E3F0FF;font-size:12px;color:#17334F;">
                © Imment · FundOps
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

### Magic link

**Subject**
```
Accedi a FundOps con un click
```

**Body (HTML)**
```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Magic link</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background:#E3F0FF;color:#17334F;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E3F0FF;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(23,51,79,0.16);">
            <tr>
              <td style="padding:24px 32px;background:#17334F;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.3px;color:#ffffff;">Imment</div>
                <div style="font-size:12px;opacity:0.85;color:#E3F0FF;">FundOps</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-size:22px;font-weight:700;color:#17334F;margin-bottom:8px;">
                  Accedi a FundOps
                </div>
                <div style="font-size:14px;line-height:1.6;color:#335C96;">
                  Usa questo link per accedere in modo sicuro, senza password.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#335C96;border-radius:10px;">
                      <a href="{{ .ConfirmationURL }}"
                         style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                        Accedi ora
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background:#E3F0FF;"></div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 28px 32px;">
                <div style="font-size:12px;color:#4A82BF;line-height:1.5;">
                  Se il pulsante non funziona, copia e incolla questo link nel browser:
                </div>
                <div style="margin-top:6px;font-size:12px;color:#17334F;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </div>
                <div style="margin-top:12px;font-size:12px;color:#4A82BF;">
                  Se non hai richiesto l’accesso, puoi ignorare questa email.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px;background:#E3F0FF;font-size:12px;color:#17334F;">
                © Imment · FundOps
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

### Invite

**Subject**
```
Sei stato invitato su FundOps
```

**Body (HTML)**
```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invito FundOps</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background:#E3F0FF;color:#17334F;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E3F0FF;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(23,51,79,0.16);">
            <tr>
              <td style="padding:24px 32px;background:#17334F;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.3px;color:#ffffff;">Imment</div>
                <div style="font-size:12px;opacity:0.85;color:#E3F0FF;">FundOps</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-size:22px;font-weight:700;color:#17334F;margin-bottom:8px;">
                  Sei stato invitato
                </div>
                <div style="font-size:14px;line-height:1.6;color:#335C96;">
                  Hai ricevuto un invito per accedere a FundOps. Clicca il pulsante per accettare.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#335C96;border-radius:10px;">
                      <a href="{{ .ConfirmationURL }}"
                         style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                        Accetta invito
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background:#E3F0FF;"></div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 28px 32px;">
                <div style="font-size:12px;color:#4A82BF;line-height:1.5;">
                  Se il pulsante non funziona, copia e incolla questo link nel browser:
                </div>
                <div style="margin-top:6px;font-size:12px;color:#17334F;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px;background:#E3F0FF;font-size:12px;color:#17334F;">
                © Imment · FundOps
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```
