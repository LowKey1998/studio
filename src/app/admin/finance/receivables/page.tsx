
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function ReceivablesPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Accounts Receivables</CardTitle>
                <CardDescription>This page will provide a detailed view of all outstanding invoices and payments due to the institution, helping to manage cash flow.</CardDescription>
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
