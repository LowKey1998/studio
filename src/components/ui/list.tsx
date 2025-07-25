
import * as React from "react"
import { cn } from "@/lib/utils"

const List = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("space-y-3", className)}
    {...props}
  />
))
List.displayName = "List"

const ListItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("flex items-center gap-4 p-3 border rounded-lg hover:bg-secondary/50 transition-colors", className)}
    {...props}
  />
))
ListItem.displayName = "ListItem"

export { List, ListItem }
