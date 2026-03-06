import AdminLayout from "@/components/layout/AdminLayout";
import UsersPermissionsTab from "@/components/admin/settings/UsersPermissionsTab";

const AdminUsers = () => {
  return (
    <AdminLayout>
      <UsersPermissionsTab />
    </AdminLayout>
  );
};

export default AdminUsers;
