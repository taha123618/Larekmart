import nodemailer from "nodemailer";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

const logger = createLogger("email-service:mailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER || "larekmart@gmail.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});

const sendMail = async ({
  email,
  subject,
  text,
}: {
  email: string;
  subject: string;
  text: string;
}) => {
  try {
    const { result: res } = await measureAsync("email.sendMail", async () => {
      return await transporter.sendMail({
        from: process.env.MAIL_FROM || '"Larekmart" <noreply@larekmart.com>',
        to: email,
        subject,
        text,
      });
    });

    logger.info(
      `Email dispatched successfully to ${email} (MessageId: ${res.messageId})`,
    );
    return res;
  } catch (error) {
    captureError(error, {
      serviceName: "email-service",
      logger,
      context: `sendMail:${email}`,
    });
    throw error;
  }
};

export default sendMail;
