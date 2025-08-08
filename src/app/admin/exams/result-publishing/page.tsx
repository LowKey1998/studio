
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function ResultPublishingPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Result Publishing</CardTitle>
                <CardDescription>This page will provide the controls to publish approved examination results to the student portal. Administrators can choose to publish results for specific courses, programmes, or entire semesters.</CardDescription>
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
