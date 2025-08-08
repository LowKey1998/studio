
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

export default function ReconciliationPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Bank Reconciliation</CardTitle>
                <CardDescription>Facilitate the reconciliation of bank statements with the system's transaction records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <Label htmlFor="statement-upload">Upload Bank Statement (CSV, OFX)</Label>
                    <Input id="statement-upload" type="file" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="statement-balance">Statement Closing Balance</Label>
                    <Input id="statement-balance" type="number" placeholder="Enter balance from statement" />
                </div>
            </CardContent>
             <CardFooter>
                <Button>Run Reconciliation</Button>
            </CardFooter>
        </Card>
    );
}
