import Conversation from "../models/Conversation.js";
import User from "../models/user.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../shared/errors/index.js";

export class GroupService {
  /**
   * Add participants to a group
   */
  async addParticipants(conversationId, adminUserId, userIds) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Check if user has admin privileges
    if (!conversation.hasAdminPrivileges(adminUserId)) {
      throw new ForbiddenError("Only admins can add participants");
    }

    // Add each user
    const addedUsers = [];
    for (const userId of userIds) {
      const user = await User.findById(userId);
      if (!user) continue;

      if (!conversation.isParticipant(userId)) {
        conversation.addParticipant(userId, "member");
        addedUsers.push({
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        });
      }
    }

    await conversation.save();

    return {
      message: "Participants added successfully",
      addedUsers,
      conversation,
    };
  }

  /**
   * Remove participant from group
   */
  async removeParticipant(conversationId, adminUserId, targetUserId) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Check if user has admin privileges
    if (!conversation.hasAdminPrivileges(adminUserId)) {
      throw new ForbiddenError("Only admins can remove participants");
    }

    // Can't remove the owner
    if (conversation.isOwner(targetUserId)) {
      throw new BadRequestError("Cannot remove the group owner");
    }

    // Can't remove yourself if you're the owner
    if (adminUserId === targetUserId && conversation.isOwner(adminUserId)) {
      throw new BadRequestError(
        "Owner cannot leave the group without transferring ownership"
      );
    }

    conversation.removeParticipant(targetUserId);
    await conversation.save();

    return {
      message: "Participant removed successfully",
      removedUserId: targetUserId,
    };
  }

  /**
   * Leave group (self-remove)
   */
  async leaveGroup(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Owner can't leave without transferring ownership
    if (conversation.isOwner(userId)) {
      throw new BadRequestError("Owner must transfer ownership before leaving");
    }

    conversation.removeParticipant(userId);

    // If they were admin, remove from admins list
    if (conversation.isAdmin(userId)) {
      conversation.demoteFromAdmin(userId);
    }

    await conversation.save();

    return {
      message: "Left group successfully",
    };
  }

  /**
   * Promote user to admin
   */
  async promoteToAdmin(conversationId, adminUserId, targetUserId) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Only owner can promote to admin
    if (!conversation.isOwner(adminUserId)) {
      throw new ForbiddenError(
        "Only the group owner can promote users to admin"
      );
    }

    // Check if target is participant
    if (!conversation.isParticipant(targetUserId)) {
      throw new BadRequestError("User is not a participant");
    }

    // Check if already admin
    if (conversation.isAdmin(targetUserId)) {
      throw new BadRequestError("User is already an admin");
    }

    conversation.promoteToAdmin(targetUserId);
    await conversation.save();

    return {
      message: "User promoted to admin successfully",
      userId: targetUserId,
    };
  }

  /**
   * Demote admin to member
   */
  async demoteFromAdmin(conversationId, adminUserId, targetUserId) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Only owner can demote admins
    if (!conversation.isOwner(adminUserId)) {
      throw new ForbiddenError("Only the group owner can demote admins");
    }

    // Can't demote the owner
    if (conversation.isOwner(targetUserId)) {
      throw new BadRequestError("Cannot demote the group owner");
    }

    // Check if user is admin
    if (!conversation.isAdmin(targetUserId)) {
      throw new BadRequestError("User is not an admin");
    }

    conversation.demoteFromAdmin(targetUserId);
    await conversation.save();

    return {
      message: "Admin demoted successfully",
      userId: targetUserId,
    };
  }

  /**
   * Update group info (name, description, avatar)
   */
  async updateGroupInfo(conversationId, userId, updates) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Check if user has admin privileges
    if (!conversation.hasAdminPrivileges(userId)) {
      throw new ForbiddenError("Only admins can update group info");
    }

    conversation.updateGroupInfo(updates);
    await conversation.save();

    return {
      message: "Group info updated successfully",
      group: conversation.group,
    };
  }

  /**
   * Transfer ownership
   */
  async transferOwnership(conversationId, currentOwnerId, newOwnerId) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Only owner can transfer ownership
    if (!conversation.isOwner(currentOwnerId)) {
      throw new ForbiddenError("Only the owner can transfer ownership");
    }

    // Check if new owner is participant
    if (!conversation.isParticipant(newOwnerId)) {
      throw new BadRequestError("New owner must be a participant");
    }

    // Update owner
    conversation.group.createdBy = newOwnerId;

    // Make new owner admin if not already
    if (!conversation.isAdmin(newOwnerId)) {
      conversation.promoteToAdmin(newOwnerId);
    }

    // Update participant roles
    conversation.updateParticipantRole(newOwnerId, "owner");
    conversation.updateParticipantRole(currentOwnerId, "admin");

    await conversation.save();

    return {
      message: "Ownership transferred successfully",
      newOwnerId,
    };
  }

  /**
   * Get group members
   */
  async getGroupMembers(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId).populate(
      "participants.user",
      "username displayName avatar email status"
    );

    if (!conversation) {
      throw new NotFoundError("Group not found");
    }

    if (conversation.type !== "group") {
      throw new BadRequestError("This is not a group conversation");
    }

    // Check if user is participant
    if (!conversation.isParticipant(userId)) {
      throw new ForbiddenError("You are not a member of this group");
    }

    return {
      participants: conversation.participants,
      admins: conversation.admins,
      owner: conversation.group.createdBy,
    };
  }
}

export const groupService = new GroupService();
