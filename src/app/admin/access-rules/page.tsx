'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { KeyRound, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AccessRulesPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound /> Access Rules & Permissions</CardTitle>
                <CardDescription>This section will provide a centralized interface for fine-grained control over user roles and their specific permissions across the entire application.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                    <Shield className="h-4 w-4"/>
                    <AlertTitle>Coming Soon!</AlertTitle>
                    <AlertDescription>
                        Advanced role-based access control (RBAC) and permission management features are currently under development.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
}
