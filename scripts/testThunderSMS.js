/**
 * Test script to ping ThunderSMS API (newportal push API)
 * Run: node scripts/testThunderSMS.js [recipient_mobile]
 * Example: node scripts/testThunderSMS.js 9538988826
 * Uses .env for credentials
 */
require("dotenv").config();
const axios = require("axios");
const https = require("https");

const TEST_MOBILE = process.argv[2] || process.env.TEST_MOBILE || "9538988826";
const OTP = "123456";

async function testThunderSMS() {
  console.log("\n=== ThunderSMS API Test (newportal push) ===\n");

  const smsUser = process.env.THUNDER_SMS_USER || process.env.THUNDER_SMS_MOBILE_NO;
  const msgtxt = `${OTP} is your OTP to Login Portal. Kindly keep this confidential for security purposes. -HYN Hive`;

  const params = {
    username: smsUser,
    signature: process.env.THUNDER_SMS_SENDER_ID,
    apikey: process.env.THUNDER_SMS_API_KEY,
    msgtxt,
    msgtype: "PM",
    dest: TEST_MOBILE,
    entityid: process.env.THUNDER_SMS_PE_ID,
    templateid: process.env.THUNDER_SMS_TEMPLATE_ID,
  };

  console.log("1. Config from .env:");
  console.log("   THUNDER_SMS_USER:", smsUser || "(not set)");
  console.log("   THUNDER_SMS_API_KEY:", process.env.THUNDER_SMS_API_KEY ? "***" : "(not set)");
  console.log("   THUNDER_SMS_SENDER_ID:", process.env.THUNDER_SMS_SENDER_ID || "(not set)");
  console.log("   THUNDER_SMS_TEMPLATE_ID:", process.env.THUNDER_SMS_TEMPLATE_ID || "(not set)");
  console.log("   THUNDER_SMS_PE_ID:", process.env.THUNDER_SMS_PE_ID || "(not set)");
  console.log("   Test recipient (dest):", TEST_MOBILE);

  console.log("\n2. Request params:");
  Object.entries(params).forEach(([k, v]) => {
    console.log(`   ${k}: ${k === "apikey" ? "***" : v}`);
  });

  try {
    const url = "https://newportal.thundersms.com/pushapi/sendmsg";
    console.log("\n3. Sending to", url, "(no session required)");
    const sendRes = await axios.get(url, {
      params,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    console.log("\n4. Response:");
    console.log("   Status:", sendRes.status, sendRes.statusText);
    console.log("   Body:", JSON.stringify(sendRes.data, null, 2));

    if (sendRes.data && sendRes.data.ErrorCode === "000") {
      console.log("\n   SUCCESS: SMS sent.");
    } else if (sendRes.data && sendRes.data.ErrorCode) {
      console.log("\n   ERROR:", sendRes.data.ErrorCode, "-", sendRes.data.ErrorMessage);
    }
  } catch (err) {
    console.error("\n   Exception:", err.message);
    if (err.response) {
      console.log("   Response status:", err.response.status);
      console.log("   Response data:", JSON.stringify(err.response.data, null, 2));
    }
  }

  console.log("\n=== Done ===\n");
}

testThunderSMS();
