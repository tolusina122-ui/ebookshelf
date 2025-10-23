
import cybersourceRestApi from "cybersource-rest-client";
import fs from "fs";
import path from "path";
import https from "https";

// Visa CyberSource credentials (read from env in production/dev)
const VISA_MERCHANT_ID = process.env.VISA_MERCHANT_ID || "supabros";
const VISA_API_KEY = process.env.VISA_API_KEY || "d380172a-a0c9-4eef-a5a7-6961a3ebafff";
const VISA_SHARED_SECRET = process.env.VISA_SHARED_SECRET || "hxEurONBUnl8dZxTyJh+TBAZ0B+k8n6tsdIuYd1/KZU=";

// Mastercard Gateway credentials (sandbox)
const MASTERCARD_MERCHANT_ID = "TEST7000100244";
const MASTERCARD_API_PASSWORD = process.env.MASTERCARD_API_PASSWORD || "5b4aa2e766f35e9e99d8cec3fa7f41f5";
const MASTERCARD_GATEWAY_HOST = "test-gateway.mastercard.com";

// Load the Visa private key
const visaPrivateKeyPath = path.join(process.cwd(), "attached_assets", "key_1dac34f5-4ff4-4418-a45f-99abcdc48abd_1760712795546.pem");
const visaPrivateKey = fs.readFileSync(visaPrivateKeyPath, "utf8");

// Load Mastercard encryption certificate
const mastercardCertPath = path.join(process.cwd(), "attached_assets", "open-banking-connect-payment-initiation-service-ClientEnc1760714734847_1760718271281.pem");
const mastercardCert = fs.existsSync(mastercardCertPath) ? fs.readFileSync(mastercardCertPath, "utf8") : null;

interface PaymentRequest {
  amount: number;
  email: string;
  paymentMethod: string;
  orderId?: string | undefined;
  // optional card data when doing server-side card processing
  card?: {
    number: string;
    expiryMonth: string;
    expiryYear: string;
    securityCode?: string;
  } | undefined;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  // message used in some test-mode returns; keep optional
  message?: string;
}

export async function processVisaPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    // If credentials and card data are available, attempt a real CyberSource request
    const canDoReal = !!(VISA_MERCHANT_ID && VISA_API_KEY && VISA_SHARED_SECRET && request.card);
    if (!canDoReal) {
      // fallback to test-mode simulation
      console.info("Visa real-processing disabled or missing card data. Running in simulated mode.");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const transactionId = `VISA_${request.orderId}_${Date.now()}`;
      return { success: true, transactionId, message: "Payment processed successfully in test mode" };
    }

    // Build CyberSource config using environment-provided creds
    const configObject: any = {
      authenticationType: "http_signature",
      merchantID: VISA_MERCHANT_ID,
      merchantKeyId: VISA_API_KEY,
      merchantsecretKey: VISA_SHARED_SECRET,
      runEnvironment: "apitest.cybersource.com",
      timeout: 30000,
      logConfiguration: { enableLog: false },
    };

    const apiClient = new cybersourceRestApi.ApiClient();
    const requestObj = new cybersourceRestApi.CreatePaymentRequest();
    requestObj.clientReferenceInformation = { code: request.orderId };
    requestObj.processingInformation = { capture: true };
    // request.card is present because canDoReal was true
    const card = request.card!;
    requestObj.paymentInformation = {
      card: {
        number: card.number,
        expirationMonth: card.expiryMonth,
        expirationYear: card.expiryYear,
        securityCode: card.securityCode,
      }
    };
    requestObj.orderInformation = {
      amountDetails: { totalAmount: request.amount.toFixed(2), currency: "USD" },
      billTo: { email: request.email }
    };

    const instance = new cybersourceRestApi.PaymentsApi(configObject, apiClient);
    return new Promise((resolve) => {
      instance.createPayment(requestObj, (error: any, data: any) => {
        if (error) {
          resolve({ success: false, error: error.message || "Payment processing failed" });
        } else if (data && (data.status === "AUTHORIZED" || data.status === 'PENDING' || data.status === 'COMPLETED')) {
          resolve({ success: true, transactionId: data.id || data.transactionReference });
        } else {
          resolve({ success: false, error: data?.errorInformation?.message || "Payment declined" });
        }
      });
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);
    return {
      success: false,
      error: error.message || "Payment system error",
    };
  }
}

export async function processMastercardPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    // For test environment, simulate successful payment
    // In production, this would integrate with actual Mastercard Gateway API
    console.log("Processing Mastercard payment in test mode:", {
      amount: request.amount,
      email: request.email,
      orderId: request.orderId
    });

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate successful payment for test mode
    const transactionId = `MC_${request.orderId}_${Date.now()}`;
    
    return {
      success: true,
      transactionId: transactionId,
      message: "Payment processed successfully in test mode"
    };

    // Production code would use this:
    /*
    const auth = Buffer.from(`merchant.${MASTERCARD_MERCHANT_ID}:${MASTERCARD_API_PASSWORD}`).toString('base64');
    
    const orderId = `MC_${request.orderId}_${Date.now()}`;
    const transactionId = "1";
    
    const requestBody = {
      apiOperation: "PAY",
      order: {
        amount: request.amount.toFixed(2),
        currency: "USD",
        id: orderId
      },
      sourceOfFunds: {
        type: "CARD",
        provided: {
          card: {
            number: "5123450000000008",
            expiry: {
              month: "12",
              year: "25"
            },
            securityCode: "100"
          }
        }
      },
      transaction: {
        source: "INTERNET"
      }
    };

    const options = {
      hostname: MASTERCARD_GATEWAY_HOST,
      port: 443,
      path: `/api/rest/version/100/merchant/${MASTERCARD_MERCHANT_ID}/order/${orderId}/transaction/${transactionId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.result === 'SUCCESS' && response.response?.gatewayCode === 'APPROVED') {
              resolve({ success: true, transactionId: response.transaction?.id || orderId });
            } else {
              resolve({ success: false, error: response.error?.explanation || "Payment declined" });
            }
          } catch (error: any) {
            resolve({ success: false, error: "Invalid gateway response" });
          }
        });
      });
      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
      req.write(JSON.stringify(requestBody));
      req.end();
    });
    */
  } catch (error: any) {
    console.error("Mastercard payment processing error:", error);
    return {
      success: false,
      error: error.message || "Payment system error",
    };
  }
}

export async function processDigitalWalletPayment(request: PaymentRequest): Promise<PaymentResponse> {
  // Google Pay and Apple Pay also go through CyberSource
  // They require additional tokenization on the frontend
  return processVisaPayment(request);
}
