"use client";

import { MoreHorizontal, ShieldCheck, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MOCK_USERS = [
  {
    id: "usr_1",
    email: "admin@masterfoundation.com",
    role: "Superuser",
    status: "Active",
    lastLogin: "Today",
  },
  {
    id: "usr_2",
    email: "analyst@company.com",
    role: "User",
    status: "Active",
    lastLogin: "Yesterday",
  },
  {
    id: "usr_3",
    email: "contractor@agency.com",
    role: "Pending",
    status: "Awaiting Approval",
    lastLogin: "Never",
  },
];

export default function UsersAccessPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
            {"Users & Access"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage users, roles, and system access permissions.
          </p>
        </div>
      </div>

      <Card className="glass-panel overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Directory
          </CardTitle>
          <CardDescription>
            Sample directory (connect to your user API when ready).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_USERS.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === "Superuser" ? "default" : "secondary"
                      }
                      className={
                        user.role === "Superuser"
                          ? "bg-primary text-primary-foreground"
                          : ""
                      }
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        user.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      }`}
                    >
                      {user.status === "Active" && (
                        <UserCheck className="mr-1 h-3 w-3" />
                      )}
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogin}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
