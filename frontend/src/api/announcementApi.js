import api from "../utils/api";

const announcementApi = {
    getAll: (params) => {
        return api.get("/notifications/announcements/", { params });
    },
    get: (id) => {
        return api.get(`/notifications/announcements/${id}/`);
    },
    create: (data) => {
        return api.post("/notifications/announcements/", data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
    },
    delete: (id) => {
        return api.delete(`/notifications/announcements/${id}/`);
    },
    markRead: (id) => {
        return api.post(`/notifications/announcements/${id}/mark_read/`);
    }
};

export default announcementApi;
