
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function PdfUploadPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>PDF Upload</CardTitle>
                <CardDescription>Upload and manage PDF learning materials for various courses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">This page will allow administrators to upload PDF documents, such as lecture notes, articles, and readings, and associate them with specific courses.</p>
                <Button disabled><Upload className="mr-2 h-4 w-4" /> Upload PDF</Button>
            </CardContent>
        </Card>
    );
}
