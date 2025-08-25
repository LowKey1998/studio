
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function ParentsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users />
                    Parent Portal Management
                </CardTitle>
                <CardDescription>
                    This section will contain tools to manage parent accounts and their access to student information.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">A dedicated portal for parents is under development.</p>
                </div>
            </CardContent>
        </Card>
    );
}
