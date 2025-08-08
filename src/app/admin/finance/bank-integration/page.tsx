
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function BankIntegrationPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Bank API Integration</CardTitle>
                <CardDescription>This page will manage the integration with bank APIs to automate transaction fetching and streamline reconciliation processes.</CardDescription>
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
