import { NextResponse } from "next/server";

import getCurrentUser from "@/app/actions/getCurrentUser";
import { pusherServer } from '@/app/libs/pusher'
import prisma from "@/app/libs/prismadb";

export async function POST(
  request: Request,
) {
  try {
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const {
      message,
      imageUrl,
      conversationId
    } = body;

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const newMessage = await prisma.message.create({
      data: {
        body: message,
        imageUrl: imageUrl,
        conversation: {
          connect: { id: conversationId }
        },
        sender: {
          connect: { id: currentUser.id }
        }
      }
    });

    await pusherServer.trigger(conversationId, 'conversation-message', {
      ...newMessage,
      sender: currentUser
    });

    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        lastMessageAt: new Date(),
        seenBy: [currentUser.email],
      },
      include: {
        users: true,
        messages: true
      }
    });

    updatedConversation.users.map((user) => {
      if (user.email) {
        pusherServer.trigger(user.email, 'conversation-list', updatedConversation);
      }
    });

    return NextResponse.json(newMessage)
  } catch (error) {
    console.log(error, 'ERROR_MESSAGES')
    return new NextResponse('Error', { status: 500 });
  }
}