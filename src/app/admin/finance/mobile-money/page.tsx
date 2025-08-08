
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function MobileMoneyPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Mobile Money Integration</CardTitle>
                <CardDescription>This page will handle the setup and management of mobile money payment integrations, such as Flutterwave, to allow students to pay fees directly through the portal.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Coming Soon!</AlertTitle>
                    <AlertDescription>
                        This feature is currently under development.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
}
