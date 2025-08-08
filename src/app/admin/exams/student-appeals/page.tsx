
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function StudentAppealsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Appeals Tracking</CardTitle>
                <CardDescription>This page will be used to manage and track academic appeals submitted by students. It will allow administrators to view appeal details, assign them for review, and record the outcomes.</CardDescription>
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
