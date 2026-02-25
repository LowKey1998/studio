'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookCheck, BookX, PlusCircle, Loader2, Library, BookUp, Upload, Trash2, Pencil, Barcode, X, Camera, Zap, AlertCircle } from "lucide-react";
import Image from 'next/image';
import { db, auth, storage } from '@/lib/firebase';
import { ref, get, set, push, onValue, serverTimestamp, update, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Html5Qrcode } from 'html5-qrcode';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type Book = {
    id: string;
    title: string;
    author: string;
    genre: string;
    status: 'Available' | 'Checked Out' | 'Requested';
    image: string;
    hint: string;
    barcode?: string;
    requesterId?: string;
    year?: number;
    count?: number;
};

const statusConfig: { [key in Book['status']]: { variant: 'default' | 'secondary' | 'destructive', icon: React.ReactNode } } = {
  "Available": { variant: 'default', icon: <BookCheck className="mr-1 h-4 w-4" /> },
  "Checked Out": { variant: 'secondary', icon: <BookX className="mr-1 h-4 w-4" /> },
  "Requested": { variant: 'destructive', icon: <BookUp className="mr-1 h-4 w-4" /> },
};

const SCANNER_ID = "isbn-scanner-region";

export default function LibraryPage() {
    const [books, setBooks] = React.useState<Book[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Add/Edit Book Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingBook, setEditingBook] = React.useState<Book | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [author, setAuthor] = React.useState('');
    const [genre, setGenre] = React.useState('');
    const [barcode, setBarcode] = React.useState('');
    const [year, setYear] = React.useState('');
    const [count, setCount] = React.useState('');
    const [imageUrl, setImageUrl] = React.useState('');
    const [imageFile, setImageFile] = React.useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // ISBN Scanner State
    const [isScannerActive, setIsScannerActive] = React.useState(false);
    const [scanner, setScanner] = React.useState<Html5Qrcode | null>(null);
    const [lookupIsbn, setLookupIsbn] = React.useState('');
    const [isSearchingIsbn, setIsSearchingIsbn] = React.useState(false);
    const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        setLoading(true);
        const booksRef = ref(db, 'libraryBooks');
        const unsubscribe = onValue(booksRef, (snapshot) => {
            if (snapshot.exists()) {
                const booksData = snapshot.val();
                const booksList: Book[] = Object.keys(booksData).map(key => ({
                    id: key,
                    ...booksData[key],
                    hint: "book cover", 
                }));
                setBooks(booksList.reverse());
            } else {
                setBooks([]);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            if (scanner) {
                scanner.stop().catch(console.error);
            }
        };
    }, [scanner]);
    
    const resetForm = () => {
        setTitle('');
        setAuthor('');
        setGenre('');
        setBarcode('');
        setYear('');
        setCount('');
        setImageUrl('');
        setImageFile(null);
        setEditingBook(null);
        setLookupIsbn('');
        setHasCameraPermission(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        if (isScannerActive) stopScanner();
    };

    const stopScanner = async () => {
        if (scanner) {
            try {
                await scanner.stop();
                setScanner(null);
            } catch (err) {
                console.error(err);
            } finally {
                setIsScannerActive(false);
            }
        }
    };

    const handleOpenDialog = (book: Book | null = null) => {
        if (book) {
            setEditingBook(book);
            setTitle(book.title);
            setAuthor(book.author);
            setGenre(book.genre);
            setBarcode(book.barcode || '');
            setYear(String(book.year || ''));
            setCount(String(book.count || ''));
            setImageUrl(book.image);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if(file && file.size > 5 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image smaller than 5MB.' });
            return;
        }
        setImageFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const fetchBookByIsbn = async (isbn: string) => {
        const cleanIsbn = isbn.replace(/\D/g, '');
        if (!cleanIsbn) return;

        setIsSearchingIsbn(true);
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
            const data = await response.json();
            if (data.totalItems > 0) {
                const item = data.items[0].volumeInfo;
                setTitle(item.title || '');
                setAuthor(item.authors ? item.authors.join(', ') : '');
                setGenre(item.categories ? item.categories.join(', ') : '');
                setYear(item.publishedDate ? item.publishedDate.split('-')[0] : '');
                setBarcode(cleanIsbn);
                if (item.imageLinks?.thumbnail) {
                    setImageUrl(item.imageLinks.thumbnail.replace('http://', 'https://'));
                }
                toast({ title: "Book Found!", description: item.title });
                if (isScannerActive) stopScanner();
            } else {
                toast({ variant: 'destructive', title: "Not Found", description: "No book found for this ISBN." });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: "Search Error", description: "Could not fetch book metadata." });
        } finally {
            setIsSearchingIsbn(false);
        }
    };

    const startScanner = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
            stream.getTracks().forEach(track => track.stop());

            setIsScannerActive(true);
            const qrScanner = new Html5Qrcode(SCANNER_ID);
            setScanner(qrScanner);
            await qrScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (decodedText) => {
                    setLookupIsbn(decodedText);
                    fetchBookByIsbn(decodedText);
                },
                () => {}
            );
        } catch (err) {
            console.error(err);
            setHasCameraPermission(false);
            setIsScannerActive(false);
            toast({ 
                variant: 'destructive', 
                title: "Camera Access Denied", 
                description: "Please enable camera permissions in your browser settings to use the ISBN scanner." 
            });
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !author) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title and Author are required.' });
            return;
        }
        setFormLoading(true);
        let finalImageUrl = editingBook?.image || 'https://placehold.co/300x400.png';
        
        try {
            if (imageFile) {
                const imageStorageRef = storageRef(storage, `libraryCovers/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(imageStorageRef, imageFile);
                finalImageUrl = await getDownloadURL(snapshot.ref);
            } else if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('placehold.co')) {
                finalImageUrl = imageUrl;
            }

            const bookData = {
                title,
                author,
                genre: genre || '',
                barcode: barcode || '',
                year: year ? parseInt(year) : null,
                count: count ? parseInt(count) : 1,
                image: finalImageUrl,
                status: editingBook?.status || 'Available'
            };

            if (editingBook) {
                await set(ref(db, `libraryBooks/${editingBook.id}`), bookData);
                toast({ title: 'Book Updated', description: `${title} has been updated.` });
            } else {
                const newBookRef = push(ref(db, 'libraryBooks'));
                await set(newBookRef, bookData);
                toast({ title: 'Book Added', description: `${title} has been added to the catalog.` });
            }
            
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteBook = async () => {
        if (!editingBook) return;
        if (!window.confirm("Are you sure you want to permanently delete this book? This action cannot be undone.")) return;
        
        setFormLoading(true);
        try {
            await remove(ref(db, `libraryBooks/${editingBook.id}`));
            toast({ title: 'Book Deleted', description: `${editingBook.title} has been removed from the catalog.` });
            setIsDialogOpen(false);
            resetForm();
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.genre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="font-headline text-2xl">Library Catalog Management</CardTitle>
                            <CardDescription>Browse, add, and manage books available in the library.</CardDescription>
                        </div>
                        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) resetForm(); }}>
                            <DialogTrigger asChild><Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Add Book</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                                <form onSubmit={handleFormSubmit}>
                                    <DialogHeader>
                                        <DialogTitle className="font-headline">{editingBook ? 'Edit' : 'Add New'} Book</DialogTitle>
                                        <DialogDescription>Enter an ISBN to auto-fill or complete details manually.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid max-h-[70vh] gap-6 overflow-y-auto py-4 pr-4">
                                        <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                <Barcode className="h-3 w-3" /> ISBN Lookup & Scan
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input 
                                                    placeholder="Enter ISBN-10 or ISBN-13..." 
                                                    value={lookupIsbn}
                                                    onChange={e => setLookupIsbn(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), fetchBookByIsbn(lookupIsbn))}
                                                    className="bg-background font-mono h-10"
                                                />
                                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={isScannerActive ? stopScanner : startScanner}>
                                                    {isScannerActive ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                                                </Button>
                                                <Button type="button" size="sm" className="h-10 px-4" onClick={() => fetchBookByIsbn(lookupIsbn)} disabled={isSearchingIsbn || !lookupIsbn}>
                                                    {isSearchingIsbn ? <Loader2 className="h-4 w-4 animate-spin"/> : <Zap className="h-4 w-4 mr-1.5"/>}
                                                    Lookup
                                                </Button>
                                            </div>
                                            {isScannerActive && <div id={SCANNER_ID} className="w-full aspect-[4/3] mt-2 rounded-lg border overflow-hidden bg-black shadow-inner" />}
                                            {hasCameraPermission === false && (
                                                <Alert variant="destructive" className="mt-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertTitle>Camera Access Required</AlertTitle>
                                                    <AlertDescription>
                                                        Please allow camera access in your browser settings to use the scanner.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>

                                        <Separator />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="title">Title *</Label>
                                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={formLoading} required />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="author">Author *</Label>
                                                <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={formLoading} required />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="genre">Genre / Category</Label>
                                            <Input id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} disabled={formLoading} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="year">Year Published</Label>
                                                <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={formLoading} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="count">Copies in Inventory</Label>
                                                <Input id="count" type="number" placeholder="1" value={count} onChange={(e) => setCount(e.target.value)} disabled={formLoading} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="barcode">Internal Barcode</Label>
                                            <Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={formLoading} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Book Cover</Label>
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-16 h-24 border rounded overflow-hidden bg-muted shrink-0">
                                                    {imageUrl ? <img src={imageUrl} alt="preview" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><Library className="h-6 w-6 opacity-20"/></div>}
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <Input id="imageUrl" placeholder="Image URL (Auto-fills from ISBN)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={formLoading || !!imageFile} className="text-xs h-8" />
                                                    <Input 
                                                        id="imageFile" 
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleFileChange}
                                                        className="h-8 text-xs file:h-full file:text-[10px] file:px-2"
                                                        ref={fileInputRef}
                                                        disabled={formLoading}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter className="flex justify-between w-full border-t pt-4">
                                        {editingBook ? (
                                            <Button type="button" variant="ghost" className="text-destructive font-bold h-10 px-4" onClick={handleDeleteBook} disabled={formLoading}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Book
                                            </Button>
                                        ) : <div/> }
                                        <div className="flex gap-2">
                                            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={formLoading} className="font-bold shadow-md">
                                                {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingBook ? 'Save Changes' : 'Add to Catalog'}
                                            </Button>
                                        </div>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full max-w-xl">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by title, author, or genre..." 
                            className="pl-8" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
                </div>
            ) : filteredBooks.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredBooks.map((book) => (
                        <Card key={book.id} className="flex flex-col overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
                            <CardHeader className="p-0">
                                <div className="relative h-56 w-full">
                                    <Image src={book.image} alt={`Cover of ${book.title}`} layout="fill" objectFit="cover" data-ai-hint={book.hint} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button variant="secondary" size="sm" onClick={() => handleOpenDialog(book)} className="font-bold">
                                            <Pencil className="mr-2 h-4 w-4"/>Edit Details
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <CardTitle className="font-headline text-lg leading-tight line-clamp-1">{book.title}</CardTitle>
                                    <CardDescription className="line-clamp-1">by {book.author}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-grow flex-col gap-2 p-4 pt-0">
                                <div className="flex flex-wrap gap-1.5">
                                    {book.genre && <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter truncate max-w-full">{book.genre.split(',')[0]}</Badge>}
                                    {book.year && <Badge variant="secondary" className="text-[10px] h-5 bg-primary/5 text-primary border-primary/10">Year: {book.year}</Badge>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 border-t pt-2">
                                    <div className="flex items-center gap-1.5 font-bold"><Library className="h-3 w-3"/> {book.count || 1} Copies</div>
                                    {book.barcode && <div className="flex items-center gap-1.5 font-mono opacity-60"><Barcode className="h-3 w-3"/> {book.barcode}</div>}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between items-center bg-muted/50 p-4 border-t">
                                <Badge variant={statusConfig[book.status].variant} className="flex items-center h-6 text-[10px] font-black uppercase tracking-widest">
                                    {statusConfig[book.status].icon}
                                    {book.status}
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(book)} className="h-8">Details</Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                        <Library className="mx-auto h-12 w-12 opacity-20" />
                        <h3 className="mt-4 text-lg font-semibold">No Books Found</h3>
                        <p className="mt-2 text-sm">
                            The library catalog is empty or no books match your filters.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
