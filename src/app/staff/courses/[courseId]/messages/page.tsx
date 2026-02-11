'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, onValue, push, set, serverTimestamp, get, runTransaction } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send, MessageSquare, PlusCircle, Trash2, BarChart, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';


type PollOption = {
    text: string;
    votes: Record<string, boolean>; // userId: true
};

type Message = {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: 'Lecturer' | 'Student';
    senderProfilePictureUrl?: string;
    type: 'discussion' | 'poll';
    title: string;
    content: string;
    options?: PollOption[];
    timestamp: number;
    comments: Record<string, Comment>;
};

type Comment = {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: 'Lecturer' | 'Student';
    senderProfilePictureUrl?: string;
    content: string;
    timestamp: number;
};

type EnrolledUser = {
    uid: string;
    name: string;
}

export default function CourseMessagesPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [messages, setMessages] = React.useState<Message[]>([]);
    
    // Form state
    const [activeTab, setActiveTab] = React.useState('discussion');
    const [discussionTitle, setDiscussionTitle] = React.useState('');
    const [discussionContent, setDiscussionContent] = React.useState('');
    const [pollQuestion, setPollQuestion] = React.useState('');
    const [pollOptions, setPollOptions] = React.useState(['', '']);

    const [comments, setComments] = React.useState<Record<string, string>>({}); // messageId -> comment text
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [commentLoading, setCommentLoading] = React.useState<string | null>(null); // messageId being commented on
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [currentUserData, setCurrentUserData] = React.useState<any>(null);
    const [enrolledUsers, setEnrolledUsers] = React.useState<EnrolledUser[]>([]);

    const [mentionQuery, setMentionQuery] = React.useState('');
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);


    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, (snapshot) => {
                    setCurrentUserData(snapshot.val());
                });
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!courseId) return;
        setLoading(true);
        const messagesRef = ref(db, `courseMessages/${courseId}`);
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const messagesList: Message[] = Object.keys(data)
                    .map(key => ({ id: key, ...data[key], comments: data[key].comments || {} }))
                    .sort((a, b) => b.timestamp - a.timestamp);
                setMessages(messagesList);
            } else {
                setMessages([]);
            }
            setLoading(false);
        });

        // Fetch enrolled users for mentions
        const fetchUsers = async () => {
            const usersRef = ref(db, 'users');
            const registrationsRef = ref(db, `registrations`);
            const [usersSnap, regsSnap] = await Promise.all([get(usersRef), get(registrationsRef)]);
            const usersData = usersSnap.val();
            const regsData = regsSnap.val();
            const studentUids = new Set<string>();

            if (regsData) {
                Object.keys(regsData).forEach(userId => {
                    Object.keys(regsData[userId]).forEach(semester => {
                        if (regsData[userId][semester].courses?.includes(courseId)) {
                            studentUids.add(userId);
                        }
                    });
                });
            }
            
            const courseRef = ref(db, `courses/${courseId}`);
            const courseSnap = await get(courseRef);
            if(courseSnap.exists()){
                const cData = courseSnap.val();
                studentUids.add(cData.lecturerId);
                if (cData.lecturerIds) cData.lecturerIds.forEach((id: string) => studentUids.add(id));
            }

            const enrolled = Array.from(studentUids).map(uid => ({ uid, name: usersData[uid]?.name || 'Unknown' })).filter(u => u.name !== 'Unknown');
            setEnrolledUsers(enrolled);
        };
        fetchUsers();

        return () => unsubscribe();
    }, [courseId]);
    
    const handlePollOptionChange = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const handleAddPollOption = () => {
        setPollOptions([...pollOptions, '']);
    };
    
    const handleRemovePollOption = (index: number) => {
        if (pollOptions.length <= 2) return;
        const newOptions = pollOptions.filter((_, i) => i !== index);
        setPollOptions(newOptions);
    };


    const handlePostMessage = async () => {
        if (!currentUser || !currentUserData) return;
        setFormLoading(true);

        const messagesRef = ref(db, `courseMessages/${courseId}`);
        const newMessageRef = push(messagesRef);
        let postData: Partial<Message> = {};
        
        try {
            if(activeTab === 'discussion') {
                 if (!discussionTitle.trim() || !discussionContent.trim()) { setFormLoading(false); return; }
                 postData = {
                     type: 'discussion',
                     title: discussionTitle,
                     content: discussionContent,
                 };
            } else { // poll
                if (!pollQuestion.trim() || pollOptions.some(opt => !opt.trim())) { setFormLoading(false); return; }
                postData = {
                    type: 'poll',
                    title: pollQuestion,
                    content: 'Please cast your vote.', // Placeholder content
                    options: pollOptions.map(opt => ({ text: opt, votes: {} })),
                };
            }

            await set(newMessageRef, {
                ...postData,
                senderId: currentUser.uid,
                senderName: currentUserData.name,
                senderRole: currentUserData.subRoles?.includes('Lecturer') ? 'Lecturer' : 'Student',
                senderProfilePictureUrl: currentUserData.profilePictureUrl || null,
                timestamp: serverTimestamp(),
                comments: {}
            });
            
            setDiscussionTitle(''); setDiscussionContent('');
            setPollQuestion(''); setPollOptions(['', '']);

        } catch (error) {
            console.error(error);
        } finally {
            setFormLoading(false);
        }
    };
    
    const handlePostComment = async (messageId: string) => {
        const commentText = comments[messageId];
        if (!commentText?.trim() || !currentUser || !currentUserData) return;

        setCommentLoading(messageId);
        try {
            const commentsRef = ref(db, `courseMessages/${courseId}/${messageId}/comments`);
            const newCommentRef = push(commentsRef);
            await set(newCommentRef, {
                senderId: currentUser.uid,
                senderName: currentUserData.name,
                senderRole: currentUserData.subRoles?.includes('Lecturer') ? 'Lecturer' : 'Student',
                senderProfilePictureUrl: currentUserData.profilePictureUrl || null,
                content: commentText,
                timestamp: serverTimestamp()
            });

            // Notify original post author if not self
            const originalPost = messages.find(m => m.id === messageId);
            if (originalPost && originalPost.senderId !== currentUser.uid) {
                await createNotification(
                    originalPost.senderId,
                    `${currentUserData.name} commented on your post in ${originalPost.title.substring(0, 20)}...`,
                    `/student/courses/${courseId}/messages`
                );
            }

            // Handle notifications for mentions
            const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
            let match;
            const mentionedUids = new Set<string>();
            while ((match = mentionRegex.exec(commentText)) !== null) {
                const uid = match[2];
                if (uid !== currentUser.uid) { // Don't notify user for self-mention
                    mentionedUids.add(uid);
                }
            }

            const courseSnap = await get(ref(db, `courses/${courseId}`));
            const courseName = courseSnap.exists() ? courseSnap.val().name : "a course";
            const notificationPromises = Array.from(mentionedUids).map(uid =>
                createNotification(uid, `${currentUserData.name} mentioned you in ${courseName}`, `/student/courses/${courseId}/messages`)
            );
            await Promise.all(notificationPromises);


            setComments(prev => ({ ...prev, [messageId]: '' }));
        } catch (error) {
            console.error(error);
        } finally {
            setCommentLoading(null);
        }
    };

    const handleCommentChange = (messageId: string, value: string) => {
        setComments(prev => ({ ...prev, [messageId]: value }));

        const caretPos = textareaRef.current?.selectionStart;
        if (caretPos) {
            const textBeforeCaret = value.substring(0, caretPos);
            const mentionMatch = textBeforeCaret.match(/@(\w*)$/);
            if (mentionMatch) {
                setMentionQuery(mentionMatch[1].toLowerCase());
                setIsMentionPopoverOpen(true);
            } else {
                setIsMentionPopoverOpen(false);
            }
        }
    };

    const handleMentionSelect = (messageId: string, name: string, uid: string) => {
        const currentText = comments[messageId] || '';
        const caretPos = textareaRef.current?.selectionStart || currentText.length;
        const textBeforeCaret = currentText.substring(0, caretPos);
        const textAfterCaret = currentText.substring(caretPos);
        
        const textForDb = textBeforeCaret.replace(/@\w*$/, `@[${name}](${uid}) `) + textAfterCaret;

        setComments(prev => ({ ...prev, [messageId]: textForDb }));
        setIsMentionPopoverOpen(false);
        setMentionQuery('');
    };
    
    const renderContent = (content: string) => {
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = content.split(mentionRegex);

        return parts.map((part, i) => {
            if (i % 3 === 1) { // This is the name part of a match
                return <strong key={i} className="text-primary bg-primary/10 px-1 rounded-sm">@{part}</strong>;
            }
            if (i % 3 === 2) { // This is the UID part, we don't render it
                return null;
            }
            return part; // This is a regular text part
        });
    };
    
    const filteredUsers = enrolledUsers.filter(u => u.name.toLowerCase().includes(mentionQuery));


    if (loading) {
        return (
            <div className="space-y-4">
                <Card><CardContent className="p-4"><Skeleton className="h-24 w-full"/></CardContent></Card>
                <Card><CardContent className="p-4"><Skeleton className="h-48 w-full"/></CardContent></Card>
                <Card><CardContent className="p-4"><Skeleton className="h-48 w-full"/></CardContent></Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                 <CardHeader>
                    <CardTitle>New Post</CardTitle>
                    <CardDescription>Start a discussion or create a poll for the class.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="discussion"><FileText className="mr-2 h-4 w-4"/> Start Discussion</TabsTrigger>
                            <TabsTrigger value="poll"><BarChart className="mr-2 h-4 w-4"/> Create Poll</TabsTrigger>
                        </TabsList>
                        <TabsContent value="discussion" className="pt-4 space-y-4">
                            <Input placeholder="Discussion Title..." value={discussionTitle} onChange={e => setDiscussionTitle(e.target.value)} />
                            <Textarea placeholder="What's on your mind?" value={discussionContent} onChange={e => setDiscussionContent(e.target.value)} rows={4}/>
                        </TabsContent>
                         <TabsContent value="poll" className="pt-4 space-y-4">
                            <Textarea placeholder="What's the poll question?" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} rows={2}/>
                            <div className="space-y-2">
                                {pollOptions.map((option, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input placeholder={`Option ${index + 1}`} value={option} onChange={e => handlePollOptionChange(index, e.target.value)} />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePollOption(index)} disabled={pollOptions.length <= 2}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={handleAddPollOption}><PlusCircle className="mr-2 h-4 w-4"/> Add Option</Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handlePostMessage} disabled={formLoading}>
                        {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Post
                    </Button>
                </CardFooter>
            </Card>

            {messages.length > 0 ? (
                messages.map(message => (
                    <Card key={message.id}>
                        <CardHeader className="flex flex-row items-start gap-4">
                             <Avatar>
                                <AvatarImage src={message.senderProfilePictureUrl} />
                                <AvatarFallback>{message.senderName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">{message.senderName}</p>
                                    {message.senderRole && <Badge variant={message.senderRole === 'Lecturer' ? 'default' : 'secondary'}>{message.senderRole}</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <h3 className="font-bold text-lg mb-2">{message.title}</h3>
                            {message.type === 'discussion' ? (
                                <p className="whitespace-pre-wrap">{renderContent(message.content)}</p>
                            ) : (
                                <p>Poll functionality is not available in staff view.</p>
                            )}
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-4">
                            {Object.values(message.comments).sort((a,b) => a.timestamp - b.timestamp).map(comment => (
                                <div key={comment.id} className="flex items-start gap-3 w-full">
                                    <Avatar className="w-8 h-8">
                                        <AvatarImage src={comment.senderProfilePictureUrl} />
                                        <AvatarFallback>{comment.senderName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 bg-muted rounded-lg p-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold">{comment.senderName}</p>
                                                {comment.senderRole && <Badge variant={comment.senderRole === 'Lecturer' ? 'default' : 'secondary'}>{comment.senderRole}</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}</p>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{renderContent(comment.content)}</p>
                                    </div>
                                </div>
                            ))}
                            <div className="w-full relative">
                                <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
                                    <PopoverTrigger asChild><span/></PopoverTrigger>
                                    <PopoverContent className="w-56 p-1">
                                        <div className="space-y-1">
                                        {filteredUsers.length > 0 ? filteredUsers.map(user => (
                                            <Button 
                                                key={user.uid} 
                                                variant="ghost" 
                                                className="w-full justify-start"
                                                onClick={() => handleMentionSelect(message.id, user.name, user.uid)}
                                            >
                                                {user.name}
                                            </Button>
                                        )) : <p className="text-xs text-center text-muted-foreground p-2">No users found</p>}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Textarea 
                                    ref={textareaRef}
                                    placeholder="Write a comment..."
                                    className="pr-24"
                                    value={comments[message.id] || ''}
                                    onChange={(e) => handleCommentChange(message.id, e.target.value)}
                                />
                                <Button 
                                    className="absolute right-2 bottom-2 h-8"
                                    onClick={() => handlePostComment(message.id)}
                                    disabled={commentLoading === message.id || !comments[message.id]?.trim()}
                                >
                                     {commentLoading === message.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Post'}
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                ))
            ) : (
                <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                        <MessageSquare className="mx-auto h-12 w-12"/>
                        <h3 className="mt-4 text-lg font-semibold">No Messages Yet</h3>
                        <p className="mt-2 text-sm">Be the first to post an announcement!</p>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
