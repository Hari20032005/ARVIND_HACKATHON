import { NextResponse } from "next/server";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: "Missing phoneNumber or message" },
        { status: 400 }
      );
    }

    const result = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${phoneNumber}`,
      body: message,
    });

    return NextResponse.json({
      success: true,
      messageId: result.sid,
      phoneNumber,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Twilio error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
