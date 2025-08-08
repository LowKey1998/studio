
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function PowerPointSlidesPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>PowerPoint Slides</CardTitle>
                <CardDescription>Upload and distribute presentation slides for your courses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">This section will be used to upload PowerPoint (.ppt, .pptx) or other presentation files for students to download.</p>
                <Button disabled><FileText className="mr-2 h-4 w-4" /> Upload Slides</Button>
            </CardContent>
        </Card>
    );
}
