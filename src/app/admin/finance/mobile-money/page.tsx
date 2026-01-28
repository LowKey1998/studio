
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function MobileMoneyPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Mobile Money Integration</CardTitle>
                <CardDescription>Set up and manage mobile money payment integrations, such as Flutterwave, to allow students to pay fees directly through the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="flex items-center space-x-2">
                    <Switch id="flutterwave-enabled" defaultChecked/>
                    <Label htmlFor="flutterwave-enabled">Enable Flutterwave Payments</Label>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="public-key">Public Key</Label>
                    <Input id="public-key" placeholder="Enter your Flutterwave public key" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="secret-key">Secret Key</Label>
                    <Input id="secret-key" type="password" placeholder="Enter your Flutterwave secret key" />
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="encryption-key">Encryption Key</Label>
                    <Input id="encryption-key" type="password" placeholder="Enter your Flutterwave encryption key" />
                </div>
            </CardContent>
            <CardFooter>
                 <Button><Save className="mr-2 h-4 w-4"/>Save Configuration</Button>
            </CardFooter>
        </Card>
    );
}
