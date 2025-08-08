
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

export default function BankIntegrationPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Bank API Integration</CardTitle>
                <CardDescription>Manage the integration with bank APIs to automate transaction fetching and streamline reconciliation processes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input id="api-key" type="password" placeholder="Enter your bank's API key" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="api-secret">API Secret</Label>
                    <Input id="api-secret" type="password" placeholder="Enter your bank's API secret" />
                </div>
            </CardContent>
            <CardFooter>
                 <Button><Save className="mr-2 h-4 w-4"/>Save Configuration</Button>
            </CardFooter>
        </Card>
    );
}
