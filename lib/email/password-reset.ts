import "server-only";

type PasswordResetEmailInput = {
  email: string;
  resetUrl: string;
};

function canLogPasswordResetLinks() {
  return process.env.NODE_ENV !== "production";
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: PasswordResetEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL;

  if (resendApiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Recuperar palavra-passe",
        text: `Use este link para definir uma nova palavra-passe: ${resetUrl}\n\nEste link expira em 30 minutos.`,
      }),
    });

    if (!response.ok) {
      throw new Error("Password reset email failed to send.");
    }

    return;
  }

  if (canLogPasswordResetLinks()) {
    console.info(`[password-reset] ${email}: ${resetUrl}`);
  }
}
