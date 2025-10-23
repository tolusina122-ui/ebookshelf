import { useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CreditCard, Smartphone, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";

// Simple BIN-based brand detection
function detectCardBrand(number: string): "visa" | "mastercard" | "unknown" {
  const cleaned = number.replace(/\s+/g, '');
  if (/^4[0-9]{0,}$/.test(cleaned)) return 'visa';
  if (/^(5[1-5][0-9]{0,}|2[2-7][0-9]{0,})$/.test(cleaned)) return 'mastercard';
  return 'unknown';
}

function formatCardNumber(value: string) {
  const cleaned = value.replace(/\D+/g, '').slice(0, 19);
  // group by 4's
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

const checkoutSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  paymentMethod: z.enum(["mastercard", "visa", "prepaid", "google_pay", "apple_pay"]),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const { items, getTotalPrice, clearCart } = useCartStore();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // card state for server-side visa charging
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardBrand, setCardBrand] = useState<"visa" | "mastercard" | "unknown">("unknown");
  const [cardTouched, setCardTouched] = useState({ number: false, expiry: false, cvv: false });

  function luhnCheck(cardNum: string) {
    const digits = cardNum.replace(/\D+/g, '');
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return digits.length > 0 && sum % 10 === 0;
  }

  function validateExpiry(mm: string, yy: string) {
    const m = parseInt(mm, 10);
    const y = parseInt(yy, 10);
    if (!mm || !yy) return false;
    if (Number.isNaN(m) || Number.isNaN(y)) return false;
    if (m < 1 || m > 12) return false;
    // handle 2-digit year
    const fullYear = yy.length === 2 ? 2000 + y : y;
    const now = new Date();
    const exp = new Date(fullYear, m - 1, 1);
    // expiry is end of month
    exp.setMonth(exp.getMonth() + 1);
    return exp.getTime() > now.getTime();
  }

  function validateCvv(code: string) {
    const cleaned = code.replace(/\D+/g, '');
    // Visa & Mastercard use 3-digit CVV
    return /^\d{3}$/.test(cleaned);
  }

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: "",
      paymentMethod: "mastercard",
    },
  });

  const paymentMethodValue = form.watch('paymentMethod');
  const cardNumberValid = luhnCheck(cardNumber.replace(/\s+/g, ''));
  const expiryValid = validateExpiry(expiryMonth, expiryYear);
  const cvvValid = validateCvv(cvv);
  const cardFormValid = cardNumberValid && expiryValid && cvvValid;

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      // If Visa selected, perform server-side charge (server creates order/transaction)
      if (data.paymentMethod === 'visa') {
        // basic client-side validation
        if (!cardNumber || !expiryMonth || !expiryYear) {
          throw new Error('Card details are required for Visa payments');
        }

        const body = {
          card: {
            number: cardNumber.replace(/\s+/g, ''),
            expiryMonth,
            expiryYear,
            securityCode: cvv,
          },
          amount: getTotalPrice(),
          currency: 'USD',
          customerEmail: data.email,
          items: items.map(item => ({ bookId: item.book.id, quantity: item.quantity, price: item.book.price })),
        };

        const response = await apiRequest('POST', '/api/payment/visa/charge', body);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || result.message || 'Visa payment failed');
        // server returns orderId when successful
        return { order: { id: result.orderId }, transaction: { id: result.transactionId } };
      }

      // Default flow: create payment session (Mastercard hosted checkout, wallets, etc.)
      const sessionResponse = await apiRequest("POST", "/api/payment/create-session", {
        customerEmail: data.email,
        paymentMethod: data.paymentMethod,
        amount: getTotalPrice(),
        currency: "USD",
        items: items.map(item => ({
          bookId: item.book.id,
          quantity: item.quantity,
          price: item.book.price,
        })),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionData.success) {
        throw new Error(sessionData.message || "Failed to create payment session");
      }

      // Step 2: Create order with session ID
      const response = await apiRequest("POST", "/api/orders", {
        customerEmail: data.email,
        paymentMethod: data.paymentMethod,
        sessionId: sessionData.sessionId,
        items: items.map(item => ({
          bookId: item.book.id,
          quantity: item.quantity,
          price: item.book.price,
        })),
      });

      const orderData = await response.json();

      if (orderData.error) {
        throw new Error(orderData.message || "Payment processing failed");
      }

      return orderData;
    },
    onSuccess: (data) => {
      setOrderId(data.order.id);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order placed successfully!",
        description: "Check your email for download links.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CheckoutForm) => {
    createOrderMutation.mutate(data);
  };

  // when the card number changes, detect brand and auto-select radio for user convenience
  const onCardNumberChange = (val: string) => {
    const formatted = formatCardNumber(val);
    setCardNumber(formatted);
    const brand = detectCardBrand(formatted);
    setCardBrand(brand);
    if (brand === 'visa') form.setValue('paymentMethod', 'visa');
    if (brand === 'mastercard') form.setValue('paymentMethod', 'mastercard');
  };

  if (items.length === 0 && !orderId) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Your cart is empty</h2>
          <Button onClick={() => setLocation("/")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Order Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-muted-foreground">
              Your order has been placed successfully. Download links have been sent to your email.
            </p>
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm font-mono" data-testid="text-order-id">Order ID: {orderId}</p>
            </div>
            <Button onClick={() => setLocation("/")} className="w-full">
              Continue Shopping
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-6 lg:py-8">
      <div className="container px-3 sm:px-4 md:px-6 max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4 lg:mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="your@email.com" 
                              {...field} 
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-1 gap-2 sm:gap-3"
                            >
                              <div className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-3 sm:p-4 hover:bg-accent transition-colors cursor-pointer">
                                <RadioGroupItem value="mastercard" id="mastercard" data-testid="radio-mastercard" />
                                <Label htmlFor="mastercard" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="text-sm sm:text-base">Mastercard</span>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-3 sm:p-4 hover:bg-accent transition-colors cursor-pointer">
                                <RadioGroupItem value="visa" id="visa" data-testid="radio-visa" />
                                <Label htmlFor="visa" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="text-sm sm:text-base">Visa</span>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-3 sm:p-4 hover:bg-accent transition-colors cursor-pointer">
                                <RadioGroupItem value="google_pay" id="google_pay" data-testid="radio-google-pay" />
                                <Label htmlFor="google_pay" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="text-sm sm:text-base">Google Pay</span>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-3 sm:p-4 hover:bg-accent transition-colors cursor-pointer">
                                <RadioGroupItem value="apple_pay" id="apple_pay" data-testid="radio-apple-pay" />
                                <Label htmlFor="apple_pay" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="text-sm sm:text-base">Apple Pay</span>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Card inputs for Visa server-side payments */}
                    {form.watch("paymentMethod") === "visa" && (
                      <div className="space-y-3">
                        <FormItem>
                          <FormLabel>Card number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input placeholder="4111 1111 1111 1111" value={cardNumber} onChange={(e) => onCardNumberChange(e.target.value)} onBlur={() => setCardTouched(t => ({ ...t, number: true }))} data-testid="input-card-number" />
                              <div className="absolute right-3 top-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">{cardBrand === 'unknown' ? 'Card' : cardBrand.toUpperCase()}</span>
                              </div>
                            </div>
                            {cardTouched.number && !cardNumberValid && (
                              <p className="text-red-600 text-sm mt-1">Invalid card number</p>
                            )}
                          </FormControl>
                        </FormItem>

                        <div className="grid grid-cols-3 gap-2">
                          <FormItem>
                            <FormLabel>Expiry month</FormLabel>
                            <FormControl>
                              <Input placeholder="MM" value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value)} onBlur={() => setCardTouched(t => ({ ...t, expiry: true }))} data-testid="input-expiry-month" />
                            </FormControl>
                          </FormItem>
                          <FormItem>
                            <FormLabel>Expiry year</FormLabel>
                            <FormControl>
                              <Input placeholder="YY" value={expiryYear} onChange={(e) => setExpiryYear(e.target.value)} onBlur={() => setCardTouched(t => ({ ...t, expiry: true }))} data-testid="input-expiry-year" />
                            </FormControl>
                          </FormItem>
                          <FormItem>
                            <FormLabel>CVV</FormLabel>
                            <FormControl>
                              <Input placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} onBlur={() => setCardTouched(t => ({ ...t, cvv: true }))} data-testid="input-cvv" />
                            </FormControl>
                            {cardTouched.cvv && !cvvValid && (
                              <p className="text-red-600 text-sm mt-1">Invalid CVV</p>
                            )}
                          </FormItem>
                        </div>
                        {cardTouched.expiry && !expiryValid && (
                          <p className="text-red-600 text-sm">Card expired or invalid expiry</p>
                        )}
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full text-sm sm:text-base"
                      disabled={createOrderMutation.isPending || (paymentMethodValue === 'visa' && !cardFormValid)}
                      data-testid="button-place-order"
                    >
                      {createOrderMutation.isPending ? "Processing..." : "Place Order"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <Card className="lg:sticky lg:top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.book.id} className="flex gap-2 sm:gap-3">
                      <img
                        src={item.book.coverImage}
                        alt={item.book.title}
                        className="w-10 h-14 sm:w-12 sm:h-16 lg:w-14 lg:h-20 object-cover rounded-md flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium line-clamp-2">{item.book.title}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold whitespace-nowrap self-start">
                        ${(parseFloat(item.book.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base sm:text-lg font-bold pt-1">
                  <span>Total</span>
                  <span data-testid="text-checkout-total">${getTotalPrice().toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}