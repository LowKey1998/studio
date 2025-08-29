
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookCheck, BookX, PlusCircle, Loader2, Library, BookUp, Upload, Trash2, Pencil } from "lucide-react";
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
import Link from 'next/link';

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

    React.useEffect(() => {
        setLoading(true);
        const booksRef = ref(db, 'libraryBooks');
        const unsubscribe = onValue(booksRef, (snapshot) => {
            if (snapshot.exists()) {
                const booksData = snapshot.val();
                const booksList: Book[] = Object.keys(booksData).map(key => ({
                    id: key,
                    ...booksData[key],
                    hint: "book cover", // default hint
                }));
                setBooks(booksList.reverse());
            } else {
                setBooks([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);
    
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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
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
            setImageUrl(book.image); // Set initial image URL for viewing
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if(file && file.size > 5 * 1024 * 1024) { // 5MB limit
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
    }
    

    const filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.genre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
        <Card className="shadow-lg border-0">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Library Catalog Management</CardTitle>
                    <CardDescription>Browse, add, and manage books available in the library.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) resetForm(); }}>
                    <DialogTrigger asChild><Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Add Book</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <form onSubmit={handleFormSubmit}>
                            <DialogHeader>
                                <DialogTitle className="font-headline">{editingBook ? 'Edit' : 'Add New'} Book</DialogTitle>
                                <DialogDescription>Fill in the details to add or update a book in the catalog.</DialogDescription>
                            </DialogHeader>
                            <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-4 pr-4">
                                <div className="space-y-1">
                                    <Label htmlFor="title">Title</Label>
                                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={formLoading} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="author">Author</Label>
                                    <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={formLoading} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="genre">Genre (Optional)</Label>
                                    <Input id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} disabled={formLoading} />
                                </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="year">Year</Label>
                                        <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={formLoading} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="count">Count</Label>
                                        <Input id="count" type="number" placeholder="1" value={count} onChange={(e) => setCount(e.target.value)} disabled={formLoading} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="barcode">Barcode (Optional)</Label>
                                    <Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={formLoading} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Book Cover</Label>
                                     <div className="flex items-center gap-4">
                                        {imageUrl && <Image src={imageUrl} alt="preview" width={40} height={60} className="rounded-sm" data-ai-hint="book cover" />}
                                        <Input 
                                            id="imageFile" 
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                            ref={fileInputRef}
                                            disabled={formLoading}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="flex justify-between w-full">
                                {editingBook ? (
                                    <Button type="button" variant="destructive" onClick={handleDeleteBook} disabled={formLoading}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </Button>
                                ) : <div/> }
                                <div className="flex gap-2">
                                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={formLoading}>
                                    {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingBook ? 'Save Changes' : 'Add Book'}
                                </Button>
                                </div>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
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
                <Card key={book.id} className="flex flex-col overflow-hidden shadow-lg transition-transform duration-300 hover:-translate-y-1">
                    <CardHeader className="p-0">
                        <div className="relative h-48 w-full">
                            <Image src={book.image} alt={`Cover of ${book.title}`} layout="fill" objectFit="cover" data-ai-hint={book.hint} />
                        </div>
                        <div className="p-4">
                            <CardTitle className="font-headline text-lg leading-tight">{book.title}</CardTitle>
                            <CardDescription>by {book.author}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-grow flex-col gap-2 p-4 pt-0">
                        <div className="flex flex-wrap gap-2">
                            {book.genre && <Badge variant="outline">{book.genre}</Badge>}
                            {book.year && <Badge variant="outline">Year: {book.year}</Badge>}
                        </div>
                        {book.count && <p className="text-sm text-muted-foreground">Copies: {book.count}</p>}
                    </CardContent>
                    <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
                        <Badge variant={statusConfig[book.status].variant} className="flex items-center">
                            {statusConfig[book.status].icon}
                            {book.status}
                        </Badge>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenDialog(book)}><Pencil className="mr-2 h-4 w-4"/>Edit</Button>
                        </div>
                    </CardFooter>
                </Card>
            ))}
            </div>
        ) : (
             <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <Library className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Books Found</h3>
                    <p className="mt-2 text-sm">
                        The library catalog is empty. Add the first book to get started!
                    </p>
                </CardContent>
            </Card>
        )}
        </div>
    );
}
