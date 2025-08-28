
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { KeyRound, Shield, PlusCircle, Trash2, Pencil, Loader2, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { allMenuItems } from '@/lib/menu-items';
import { Separator } from '@/components/ui/separator';

type SubRole = {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
};

// Firebase keys cannot contain '.', '#', '$', '[', ']', or '/'.
// We replace '/' with a safe character.
const sanitizeKey = (key: string) => key.replace(/\//g, '|');
const desanitizeKey = (key: string) => key.replace(/\|/g, '__');


export default function AccessRulesPage() {
    const [subRoles, setSubRoles] = React.useState<SubRole[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRole, setEditingRole] = React.useState<SubRole | null>(null);
    const [roleName, setRoleName] = React.useState('');
    const [permissions, setPermissions] = React.useState<Record<string, boolean>>({});

    const { toast } = useToast();
    
    React.useEffect(() => {
        const subRolesRef = ref(db, 'settings/subRoles');
        const unsubscribe = onValue(subRolesRef, (snapshot) => {
             if (snapshot.exists()) {
                const subRolesData = snapshot.val();
                const sanitizedRoles = Object.keys(subRolesData).map(id => {
                    const role = subRolesData[id];
                    const sanitizedPermissions: Record<string, boolean> = {};
                    if(role.permissions) {
                        for(const key in role.permissions) {
                           sanitizedPermissions[desanitizeKey(key)] = role.permissions[key];
                        }
                    }
                    return { id, name: role.name, permissions: sanitizedPermissions };
                });
                setSubRoles(sanitizedRoles);
            } else { setSubRoles([]) }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetRoleForm = () => {
        setEditingRole(null);
        setRoleName('');
        setPermissions({});
    };

    const openRoleDialog = (role: SubRole | null) => {
        if (role) {
            setEditingRole(role);
            setRoleName(role.name);
            setPermissions(role.permissions || {});
        } else {
            resetRoleForm();
        }
        setIsDialogOpen(true);
    };
    
    const handlePermissionChange = (permissionKey: string, checked: boolean) => {
        setPermissions(prev => {
            const newPermissions = { ...prev };
            if (checked) {
                newPermissions[permissionKey] = true;
            } else {
                delete newPermissions[permissionKey];
            }
            return newPermissions;
        });
    };

    const handleSaveRole = async () => {
        if (!roleName) {
            toast({ variant: 'destructive', title: 'Role name required' });
            return;
        }
        setSaving(true);
        
        const sanitizedPermissions: Record<string, boolean> = {};
        for(const key in permissions){
            sanitizedPermissions[sanitizeKey(key)] = permissions[key];
        }

        const roleData = { name: roleName, permissions: sanitizedPermissions };
        
        try {
            if (editingRole) {
                await update(ref(db, `settings/subRoles/${editingRole.id}`), roleData);
                toast({ title: 'Role Updated' });
            } else {
                await push(ref(db, `settings/subRoles`), roleData);
                toast({ title: 'Role Created' });
            }
            setIsDialogOpen(false);
            resetRoleForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save role', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!window.confirm("Are you sure? This may affect users assigned to this role.")) {
            return;
        }
        await remove(ref(db, `settings/subRoles/${roleId}`));
        toast({ title: "Role deleted" });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><KeyRound /> Access Rules & Permissions</CardTitle>
                    <CardDescription>Create and manage staff sub-roles to grant specific permissions across the system.</CardDescription>
                </div>
                 <Button onClick={() => openRoleDialog(null)}><PlusCircle className="mr-2 h-4"/>New Sub-Role</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {loading ? (
                        <>
                           <Skeleton className="h-16 w-full" />
                           <Skeleton className="h-16 w-full" />
                        </>
                    ) : subRoles.length > 0 ? (
                        subRoles.map(role => (
                            <Card key={role.id}>
                                <CardHeader className="flex flex-row items-center justify-between p-4">
                                    <p className="font-semibold">{role.name}</p>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" onClick={() => openRoleDialog(role)}><Pencil className="mr-2 h-4 w-4"/>Edit</Button>
                                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteRole(role.id)}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                           <Shield className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Sub-Roles Created</h3>
                            <p className="mt-2 text-sm">Create a sub-role to define specific user permissions.</p>
                        </div>
                    )}
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => {if(!open) resetRoleForm(); setIsDialogOpen(open);}}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingRole ? `Edit ${editingRole.name}` : "Create New Sub-Role"}</DialogTitle>
                            <DialogDescription>Define the name and permissions for this staff sub-role.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Input placeholder="Role Name, e.g., Bursar" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                             <div className="max-h-[60vh] overflow-y-auto pr-4">
                                <h4 className="text-sm font-medium mb-2">Special Permissions</h4>
                                <div className="space-y-2 p-3 border rounded-md">
                                     <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id='canBeAssignedClass' 
                                            checked={!!permissions['canBeAssignedClass']} 
                                            onCheckedChange={(checked) => handlePermissionChange('canBeAssignedClass', !!checked)}
                                        />
                                        <Label htmlFor='canBeAssignedClass' className="font-normal">Assignable to Class</Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground pl-6">Allows this role to be assigned to courses as a lecturer in Lecturer Allocation.</p>
                                </div>

                                <Separator className="my-4"/>

                                 <h4 className="text-sm font-medium mb-2">Page & Menu Access</h4>
                                <Accordion type="multiple" defaultValue={allMenuItems.map(item => item.label)} className="w-full">
                                {allMenuItems.filter(item => item.items && item.items.length > 0).map(item => (
                                    <AccordionItem value={item.label} key={item.label}>
                                        <AccordionTrigger>{item.label}</AccordionTrigger>
                                        <AccordionContent className="space-y-2 max-h-60 overflow-y-auto pr-4">
                                            {item.items?.map(subItem => (
                                                <div key={subItem.href} className="flex items-center gap-2">
                                                    <Checkbox 
                                                        id={subItem.href} 
                                                        checked={!!permissions[subItem.href]} 
                                                        onCheckedChange={(checked) => handlePermissionChange(subItem.href, !!checked)}
                                                    />
                                                    <Label htmlFor={subItem.href} className="font-normal">{subItem.label}</Label>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                                </Accordion>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveRole} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}Save Role</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
