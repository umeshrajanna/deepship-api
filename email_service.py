import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY")

class EmailService:
    @staticmethod
    async def send_magic_link(email: str, token: str, username: str) -> bool:
        """Send magic link email using Resend"""
        try:
            # frontend_url = "https://noirai-production.up.railway.app/" #os.getenv("https://noirai-production.up.railway.app/", "http://localhost:5500")
            frontend_url = os.getenv("FRONTEND_URL")
            # frontend_url = "https://www.deepship.dev/"
            magic_link = f"{frontend_url}verify?token={token}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}
                    .container {{ max-width: 600px; margin: 40px auto; background: #1a1a1a; border-radius: 12px; border: 1px solid #333; }}
                    .header {{ background: linear-gradient(135deg, #174236, #1a5a47); padding: 40px 30px; text-align: center; }}
                    .logo {{ font-size: 32px; font-weight: bold; color: #00ff41; letter-spacing: 2px; }}
                    .content {{ padding: 40px 30px; color: #fff; }}
                    h1 {{ color: #00ff41; font-size: 24px; margin: 0 0 20px 0; }}
                    p {{ color: #ccc; line-height: 1.6; margin: 0 0 20px 0; }}
                    .button {{ display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #00ff41, #00cc33); 
                              color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }}
                    .link-box {{ background: #0a0a0a; padding: 15px; border-radius: 6px; border: 1px solid #333; 
                                margin: 20px 0; word-break: break-all; }}
                    .link-text {{ color: #00ff41; font-size: 12px; }}
                    .warning {{ background: #2a1a1a; border-left: 4px solid #f44; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ background: #0a0a0a; padding: 30px; text-align: center; border-top: 1px solid #333; }}
                    .footer p {{ color: #666; font-size: 12px; margin: 5px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">NOIR AI</div>
                    </div>
                    <div class="content">
                        <h1>Welcome back{', ' + username if username else ''}! 👋</h1>
                        <p>Click the button below to securely log in to your NOIR AI account. 
                           This link will expire in <strong style="color: #ff9900;">15 minutes</strong>.</p>
                        <div style="text-align: center;">
                            <a href="{magic_link}" class="button">🔐 Log In to NOIR AI</a>
                        </div>
                        <p style="font-size: 14px; color: #999;">Or copy and paste this link:</p>
                        <div class="link-box">
                            <p class="link-text">{magic_link}</p>
                        </div>
                        <div class="warning">
                            <p style="color: #faa; margin: 0;"><strong>⚠️ Security Notice:</strong> 
                               If you didn't request this, ignore this email.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>NOIR AI - Intelligent Conversations</p>
                        <p>© 2024 NOIR AI. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """ 
            
            params = {
                "from": "NOIR AI <onboarding@resend.dev>",  # Use resend.dev for testing
                "to": [email],
                "subject": "🔐 Your NOIR AI Login Link",
                "html": html_content,
            }
            
            import time
            # email_response = resend.Emails.send(params)
            for i in range(3):
                try:
                    email_response = resend.Emails.send(params)
                    break
                except:
                    if i == 2: raise
                    time.sleep(2 ** i)

            print(f"✅ Email sent: {email_response}")
            
            return True
            
        except Exception as e:
            print(f"❌ Email send error: {e}")
            return False