
import cybersourceRestApi from "cybersource-rest-client";
import fs from "fs";
import path from "path";

// Load credentials
const MERCHANT_ID = "supabros";
const API_KEY = "d380172a-a0c9-4eef-a5a7-6961a3ebafff";
const SHARED_SECRET = "hxEurONBUnl8dZxTyJh+TBAZ0B+k8n6tsdIuYd1/KZU=";

// Load the private key
const privateKeyPath = path.join(process.cwd(), "attached_assets", "key_1dac34f5-4ff4-4418-a45f-99abcdc48abd_1760712795546.pem");
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

interface PaymentRequest {
  amount: number;
  email: string;
  paymentMethod: string;
  orderId: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export async function processVisaPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    const configObject = {
      authenticationType: "http_signature",
      merchantID: MERCHANT_ID,
      merchantKeyId: API_KEY,
      merchantsecretKey: SHARED_SECRET,
      runEnvironment: "apitest.cybersource.com", // Use production URL when ready
      timeout: 30000,
      logConfiguration: {
        enableLog: false,
      },
    };

    const apiClient = new cybersourceRestApi.ApiClient();
    const requestObj = new cybersourceRestApi.CreatePaymentRequest();

    // Client reference information
    requestObj.clientReferenceInformation = {
      code: request.orderId,
    };

    // Processing information
    requestObj.processingInformation = {
      capture: true,
    };

    // Payment information - tokenized card (for production, integrate with frontend tokenization)
    requestObj.paymentInformation = {
      card: {
        type: request.paymentMethod === "visa" ? "001" : "002", // 001 = Visa, 002 = Mastercard
      },
    };

    // Order information
    requestObj.orderInformation = {
      amountDetails: {
        totalAmount: request.amount.toFixed(2),
        currency: "USD",
      },
      billTo: {
        email: request.email,
      },
    };

    const instance = new cybersourceRestApi.PaymentsApi(configObject, apiClient);

    return new Promise((resolve, reject) => {
      instance.createPayment(requestObj, (error: any, data: any, response: any) => {
        if (error) {
          console.error("CyberSource Payment Error:", error);
          resolve({
            success: false,
            error: error.message || "Payment processing failed",
          });
        } else if (data && data.status === "AUTHORIZED") {
          resolve({
            success: true,
            transactionId: data.id,
          });
        } else {
          resolve({
            success: false,
            error: data?.errorInformation?.message || "Payment declined",
          });
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
  // Mastercard will use the same CyberSource gateway
  // When Mastercard sandbox credentials are ready, they can be integrated here
  return processVisaPayment(request);
}

export async function processDigitalWalletPayment(request: PaymentRequest): Promise<PaymentResponse> {
  // Google Pay and Apple Pay also go through CyberSource
  // They require additional tokenization on the frontend
  return processVisaPayment(request);
}
