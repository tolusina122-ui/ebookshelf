import { useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: "",
      paymentMethod: "mastercard",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      // Step 1: Create payment session
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
      return response.json();
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

  if (items.length === 0 && !orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Your cart is empty</h2>
          <Button onClick={() => setLocation("/")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-background py-6 md:py-12">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                              className="grid grid-cols-1 gap-3"
                            >
                              <div className="flex items-center space-x-2 border rounded-md p-4 hover-elevate">
                                <RadioGroupItem value="mastercard" id="mastercard" data-testid="radio-mastercard" />
                                <Label htmlFor="mastercard" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <CreditCard className="h-5 w-5" />
                                  <span>Mastercard</span>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 border rounded-md p-4 hover-elevate">
                                <RadioGroupItem value="visa" id="visa" data-testid="radio-visa" />
                                <Label htmlFor="visa" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <CreditCard className="h-5 w-5" />
                                  <span>Visa</span>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 border rounded-md p-4 hover-elevate">
                                <RadioGroupItem value="google_pay" id="google_pay" data-testid="radio-google-pay" />
                                <Label htmlFor="google_pay" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <Smartphone className="h-5 w-5" />
                                  <span>Google Pay</span>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 border rounded-md p-4 hover-elevate">
                                <RadioGroupItem value="apple_pay" id="apple_pay" data-testid="radio-apple-pay" />
                                <Label htmlFor="apple_pay" className="flex items-center gap-2 cursor-pointer flex-1">
                                  <Wallet className="h-5 w-5" />
                                  <span>Apple Pay</span>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full"
                      disabled={createOrderMutation.isPending}
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
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.book.id} className="flex gap-3">
                      <img
                        src={item.book.coverImage}
                        alt={item.book.title}
                        className="w-12 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{item.book.title}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        ${(parseFloat(item.book.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between text-lg font-bold">
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
