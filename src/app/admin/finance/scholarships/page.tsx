
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function ScholarshipDisbursementPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Scholarship Disbursement</CardTitle>
                <CardDescription>This page will be used to manage and track the disbursement of scholarships and bursaries to students, ensuring funds are allocated correctly.</CardDescription>
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
