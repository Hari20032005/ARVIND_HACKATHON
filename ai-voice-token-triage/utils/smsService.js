// SMS Notification Utility
export const sendMockSMS = async (phoneNumber, message) => {
 const res = await fetch("/api/send-whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phoneNumber, message }),
  });
  
  // Return success response
  return {
    success: true,
    messageId: `sms_${Date.now()}`,
    phoneNumber,
    message,
    timestamp: new Date().toISOString()
  };
};

// Mock phone numbers for demo
export const mockPhoneNumbers = [
  '+1234567890',
  '+1987654321',
  '+1555123456',
  '+1555987654',
  '+1555456789'
];