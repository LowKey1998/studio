
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Barcode, X, User, Check, Power, PowerOff } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, update, push, set } from 'firebase/database';
import { format, addDays } from 'date-fns';
import { createNotification } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';

const SCANNER_REGION_ID = "barcode-scanner-region";

type ScannedBook = { id: string, title: string, status: string, currentHolder?: string };
type ScannedUser = { uid: string, name: string };
type LibraryBook = { id: string, title: string, barcode?: string, status: 'Available' | 'Checked Out' | 'Requested'; [key: string]: any };
type AppUser = { uid: string, id: string; name: string; [key: string]: any };

export default function BarcodeScannerPage() {
    const [scanner, setScanner] = React.useState<Html5Qrcode | null>(null);
    const [isScannerActive, setIsScannerActive] = React.useState(false);
    const [scannerError, setScannerError] = React.useState<string | null>(null);
    const [mode, setMode] = React.useState<'checkout' | 'checkin'>('checkout');

    const [allBooks, setAllBooks] = React.useState<LibraryBook[]>([]);
    const [allUsers, setAllUsers] = React.useState<AppUser[]>([]);

    const [scannedBook, setScannedBook] = React.useState<ScannedBook | null>(null);
    const [scannedUser, setScannedUser] = React.useState<ScannedUser | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);
    
    const { toast } = useToast();
    
    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [booksSnap, usersSnap] = await Promise.all([
                    get(ref(db, 'libraryBooks')),
                    get(ref(db, 'users'))
                ]);
                if (booksSnap.exists()) {
                    setAllBooks(Object.entries(booksSnap.val()).map(([id, data]) => ({ id, ...(data as any) })));
                }
                if (usersSnap.exists()) {
                    setAllUsers(Object.entries(usersSnap.val()).map(([uid, data]) => ({ uid, ...(data as any) })));
                }
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load library and user data." });
            }
        };
        fetchData();
    }, [toast]);

    const startScanner = React.useCallback(async () => {
        if (isScannerActive) return;
        
        setIsScannerActive(true);
        setScannerError(null);
        setScannedBook(null);
        setScannedUser(null);

        try {
            await Html5Qrcode.getCameras();
            const qrCodeScanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
            setScanner(qrCodeScanner);
            
            qrCodeScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (decodedText, decodedResult) => {
                    if (isProcessing) return;

                    // Try to find a book first
                    const foundBook = allBooks.find(b => b.barcode === decodedText);
                    if (foundBook) {
                        let currentHolder;
                        if (foundBook.status === 'Checked Out' || foundBook.status === 'Requested') {
                            const reqSnap = await get(ref(db, 'bookRequests'));
                            if (reqSnap.exists()) {
                                const req = Object.values(reqSnap.val()).find((r: any) => r.bookId === foundBook.id && r.status === 'Checked Out');
                                currentHolder = (req as any)?.userName;
                            }
                        }
                        setScannedBook({ id: foundBook.id, title: foundBook.title, status: foundBook.status, currentHolder });
                        toast({ title: "Book Found!", description: foundBook.title });
                        return;
                    }

                    // If checking out and no book is scanned yet, look for a user
                    if (mode === 'checkout' && !scannedBook) {
                        const foundUser = allUsers.find(u => u.id === decodedText);
                        if (foundUser) {
                            setScannedUser({ uid: foundUser.uid, name: foundUser.name });
                            toast({ title: "User Found!", description: foundUser.name });
                            return;
                        }
                    }
                    
                    toast({ variant: 'destructive', title: "Not Found", description: `Could not find a matching book or user for barcode: ${decodedText}` });
                },
                (errorMessage) => { /* ignore parse errors */ }
            ).catch(err => {
                setScannerError("Could not start scanner. Please ensure you have a camera and have granted permissions.");
            });
        } catch (err) {
            setScannerError("Camera not found or permissions denied.");
            setIsScannerActive(false);
        }
    }, [isScannerActive, mode, toast, scannedBook, isProcessing, allBooks, allUsers]);

    const stopScanner = React.useCallback(async () => {
        if (scanner && isScannerActive) {
            try {
                await scanner.stop();
            } catch (err) {
                console.error("Error stopping scanner:", err);
            } finally {
                 setIsScannerActive(false);
                 setScanner(null);
            }
        }
    }, [scanner, isScannerActive]);

    const handleCheckIn = async () => {
        if (!scannedBook || scannedBook.status !== 'Checked Out') {
            toast({ variant: 'destructive', title: 'Invalid Operation', description: 'Scan a book that is currently checked out.' });
            return;
        }
        setIsProcessing(true);
        try {
            const requestRef = ref(db, 'bookRequests');
            const reqSnap = await get(requestRef);
            let reqId, userIdToNotify;
            if(reqSnap.exists()){
                const foundReq = Object.entries(reqSnap.val()).find(([id, req]:[string,any]) => req.bookId === scannedBook.id && req.status === 'Checked Out');
                if(foundReq) {
                    reqId = foundReq[0];
                    userIdToNotify = (foundReq[1] as any).userId;
                }
            }

            const updates: Record<string, any> = {};
            updates[`libraryBooks/${scannedBook.id}/status`] = 'Available';
            if(reqId) updates[`bookRequests/${reqId}/status`] = 'Returned';

            await update(ref(db), updates);
            
            if (userIdToNotify) {
                 await createNotification(userIdToNotify, `The book "${scannedBook.title}" has been successfully returned. Thank you!`, '/student/library');
            }
            
            toast({ title: 'Book Checked In', description: `${scannedBook.title} has been marked as available.` });
            setScannedBook(null);
            setScannedUser(null);
        } catch(e: any) { toast({ variant: 'destructive', title: 'Check-in Failed', description: e.message }); } 
        finally { setIsProcessing(false); }
    };

    const handleCheckOut = async () => {
        if (!scannedBook || !scannedUser) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please scan both a book and a user.' });
            return;
        }
        if (scannedBook.status !== 'Available') {
             toast({ variant: 'destructive', title: 'Book Not Available', description: 'This book is not currently available for checkout.' });
            return;
        }
        setIsProcessing(true);
        const returnDate = addDays(new Date(), 14);

        try {
            const newRequestRef = push(ref(db, 'bookRequests'));
            await set(newRequestRef, {
                bookId: scannedBook.id,
                bookTitle: scannedBook.title,
                userId: scannedUser.uid,
                userName: scannedUser.name,
                requestDate: new Date().toISOString(),
                status: 'Checked Out',
                checkoutDate: new Date().toISOString(),
                dueDate: format(returnDate, 'yyyy-MM-dd')
            });
            await update(ref(db, `libraryBooks/${scannedBook.id}`), { status: 'Checked Out' });
            await createNotification(
                scannedUser.uid,
                `A book "${scannedBook.title}" has been checked out to you. It is due on ${format(returnDate, 'PPP')}.`,
                '/student/library'
            );
            toast({ title: "Book Checked Out", description: `${scannedBook.title} handed over to ${scannedUser.name}.` });
            setScannedBook(null);
            setScannedUser(null);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Direct Checkout Failed', description: e.message }); }
        finally { setIsProcessing(false); }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Barcode Scanner</CardTitle>
                <CardDescription>Quickly check books in or out by scanning their barcodes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-center gap-4">
                     <Button onClick={() => setMode('checkout')} variant={mode === 'checkout' ? 'default' : 'outline'} disabled={isScannerActive}>Checkout</Button>
                     <Button onClick={() => setMode('checkin')} variant={mode === 'checkin' ? 'default' : 'outline'} disabled={isScannerActive}>Check-in</Button>
                </div>
                 <div className="flex justify-center">
                    <Button onClick={isScannerActive ? stopScanner : startScanner}>
                        {isScannerActive ? <PowerOff className="mr-2 h-4 w-4"/> : <Power className="mr-2 h-4 w-4" />}
                        {isScannerActive ? 'Stop Scanner' : 'Start Scanner'}
                    </Button>
                </div>
                 <div className="w-full aspect-video border rounded-md bg-muted flex items-center justify-center" id={SCANNER_REGION_ID}>
                    {!isScannerActive && <Barcode className="h-16 w-16 text-muted-foreground"/>}
                </div>
                {scannerError && <Alert variant="destructive"><AlertDescription>{scannerError}</AlertDescription></Alert>}

                 <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle>Scanned Book</CardTitle></CardHeader>
                        <CardContent>
                            {scannedBook ? (
                                <div className="space-y-1 text-sm">
                                    <p><strong>Title:</strong> {scannedBook.title}</p>
                                    <p><strong>Status:</strong> <Badge>{scannedBook.status}</Badge></p>
                                     {scannedBook.currentHolder && <p><strong>Held By:</strong> {scannedBook.currentHolder}</p>}
                                </div>
                            ) : <p className="text-muted-foreground text-sm">Scan a book's barcode.</p>}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Scanned User</CardTitle></CardHeader>
                        <CardContent>
                           {scannedUser ? (
                                <div className="space-y-1 text-sm">
                                    <p><strong>Name:</strong> {scannedUser.name}</p>
                                </div>
                            ) : <p className="text-muted-foreground text-sm">{mode === 'checkout' ? 'Scan a user ID card.' : 'Not required for check-in.'}</p>}
                        </CardContent>
                    </Card>
                 </div>

                 <div className="flex justify-center">
                    {mode === 'checkout' && <Button onClick={handleCheckOut} disabled={isProcessing || !scannedBook || !scannedUser}>Confirm Checkout</Button>}
                    {mode === 'checkin' && <Button onClick={handleCheckIn} disabled={isProcessing || !scannedBook}>Confirm Check-in</Button>}
                 </div>
            </CardContent>
        </Card>
    );
}
