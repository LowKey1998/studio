
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { allMenuItems } from '@/lib/menu-items';

export default function StaffProfilePage() {
    const { userProfile, loading } = useAuth();

    const allowedPermissions = React.useMemo(() => {
        if (!userProfile?.permissions) return [];
        
        const permissionLabels = new Set<string>();
        const allowedHrefs = Object.keys(userProfile.permissions).filter(key => userProfile.permissions![key]);
        
        allMenuItems.forEach(category => {
            if (category.items) {
                category.items.forEach(item => {
                    if (allowedHrefs.includes(item.href)) {
                        permissionLabels.add(item.label);
                    }
                });
            }
        });

        return Array.from(permissionLabels).sort();
    }, [userProfile?.permissions]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{userProfile?.name}</CardTitle>
                    <CardDescription>{userProfile?.email}</CardDescription>
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-2">My Roles</h3>
                    <div className="flex flex-wrap gap-2">
                        {userProfile?.subRoles?.map(role => (
                            <Badge key={role} variant="secondary">{role}</Badge>
                        )) || <p className="text-sm text-muted-foreground">No specific sub-roles assigned.</p>}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>My Permissions</CardTitle>
                    <CardDescription>You have access to the following pages and features based on your assigned roles.</CardDescription>
                </CardHeader>
                <CardContent>
                    {allowedPermissions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {allowedPermissions.map(permission => (
                                <Badge key={permission} variant="outline">{permission}</Badge>
                            ))}
                        </div>
                    ) : (
                         <p className="text-sm text-muted-foreground">You have not been granted access to any specific admin pages.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
