"use client"

import { useEffect, useState } from "react"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/components/ui/drawer"
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { PostForm } from "./post-form"
import { Button, buttonVariants } from "./ui/button"
import { PlantIcon } from "@phosphor-icons/react"
import { api } from "@puma-brain/backend/convex/_generated/api"
import { useQuery } from "convex/react"

export const PostDialog = () => {
    const hasPostedToday = useQuery(api.posts.hasPostedToday);
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    if (hasPostedToday) {
        return (
            <Button disabled size="sm">
                <PlantIcon />
                Write
            </Button>
        )
    }

    if (isMobile) {
        return (
            <Drawer>
                <DrawerTrigger asChild>
                    <Button size="sm">
                        <PlantIcon />
                        Write</Button>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="p-6">
                        <PostForm />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog>
            <DialogTrigger className={buttonVariants({ variant: "default", size: "sm" })}>
                <PlantIcon />
                Write
            </DialogTrigger>
            <DialogContent>
                <div className="p-6">
                    <PostForm />
                </div>
            </DialogContent>
        </Dialog>
    )
}