
import cybersourceRestApi from "cybersource-rest-client";
import fs from "fs";
import path from "path";
import https from "https";

// Visa CyberSource credentials
const VISA_MERCHANT_ID = "supabros";
const VISA_API_KEY = "d380172a-a0c9-4eef-a5a7-6961a3ebafff";
const VISA_SHARED_SECRET = "hxEurONBUnl8dZxTyJh+TBAZ0B+k8n6tsdIuYd1/KZU=";

// Mastercard Gateway credentials (from environment or config)
const MASTERCARD_MERCHANT_ID = process.env.MASTERCARD_MERCHANT_ID || "TEST_MERCHANT";
const MASTERCARD_API_PASSWORD = process.env.MASTERCARD_API_PASSWORD || "";
const MASTERCARD_GATEWAY_HOST = process.env.MASTERCARD_GATEWAY_HOST || "test-gateway.mastercard.com";

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
      merchantID: VISA_MERCHANT_ID,
      merchantKeyId: VISA_API_KEY,
      merchantsecretKey: VISA_SHARED_SECRET,
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
  try {
    // Mastercard Gateway API integration
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
            // In production, card details would come from tokenized frontend
            // This is placeholder for the integration structure
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
      },
      ...(mastercardCert ? { 
        cert: mastercardCert,
        rejectUnauthorized: true 
      } : {})
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.result === 'SUCCESS' && response.response?.gatewayCode === 'APPROVED') {
              resolve({
                success: true,
                transactionId: response.transaction?.id || orderId,
              });
            } else {
              resolve({
                success: false,
                error: response.error?.explanation || response.response?.gatewayCode || "Payment declined",
              });
            }
          } catch (error: any) {
            resolve({
              success: false,
              error: "Invalid response from payment gateway",
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error("Mastercard Gateway Error:", error);
        resolve({
          success: false,
          error: error.message || "Payment gateway connection failed",
        });
      });

      req.write(JSON.stringify(requestBody));
      req.end();
    });
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
