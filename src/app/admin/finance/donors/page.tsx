
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function DonorFundTrackingPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Donor Fund Tracking</CardTitle>
                <CardDescription>This page will be used for managing and reporting on funds received from donors, ensuring transparency and accountability.</CardDescription>
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
