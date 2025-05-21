// === Supabase Configuration ===
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://xfasfldsoqiciqnfbauf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmYXNmbGRzb3FpY2lxbmZiYXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4NzA1MjAsImV4cCI6MjA2MDQ0NjUyMH0.egaYl_7zGqtGwNtHpsIRYVT394UfOK2VZOIQMRIC7Ks"
);

// === Auth Guard for Admin Only Access ===
(async () => {
  const { data: sessionData, error } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session || error) {
    console.warn("🔒 Not logged in. Redirecting...");
    return (window.location.href = "login");
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("register_as")
    .eq("auth_user_id", session.user.id)
    .single();

  if (!profile || profile.register_as !== "admin") {
    console.warn("⛔ Unauthorized user. Redirecting...");
    return (window.location.href = "login");
  }
})();


// === Logout Handler ===
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login";
  });
}

// === Approval Logic ===
window.approveRequest = async (id, bloodGroup, unit) => {
  try {
    const intUnit = parseInt(unit); // 🔥 Cast it here
    console.log("Approving request:", id, bloodGroup, intUnit);
    


    // 1. Call RPC
    const { data: rpcData, error: stockErr } = await supabase.rpc("decrement_stock", {
      blood_group_input: bloodGroup.trim().toUpperCase(),
      requested_units: parseInt(unit),
    });
    
    console.log("🩸 RPC Data:", rpcData);
    console.log("⚙️ RPC Response:", rpcData);
    console.log("⚠️ RPC Error:", stockErr);
    
    if (stockErr) {
      console.error("❌ Stock decrement error:", stockErr);
      
      // If Supabase function returns a custom error message
      if (stockErr.message.includes("Not enough units")) {
        return alert("❌ Not enough units available in stock for this blood group.");
      }
    
      return alert("❌ Failed to decrement stock: " + stockErr.message);
    }
    

    // 2. Update status
    const { error: updateErr } = await supabase
      .from("requests")
      .update({ status: "approved" })
      .eq("id", id);

    if (updateErr) {
      console.error("❌ Request update error:", updateErr);
      alert("❌ Failed to approve request: " + updateErr.message);
      return;
    }

    alert("✅ Request approved!");

    // 3. Delay & Refresh
    
      loadDashboard();
      loadRequestSection();
    

    console.log("👀 ID:", id);
    console.log("🩸 Blood Group:", bloodGroup);
    console.log("📦 Unit (original):", unit, "type:", typeof unit);
    console.log("📦 Unit (casted):", parseInt(unit), "type:", typeof parseInt(unit));


  } catch (err) {
    console.error("❌ Unexpected error:", err);
    alert("❌ Unexpected error occurred.");
  }
};





window.rejectRequest = async (id) => {
  try {
    console.log("Rejecting request:", id);

    const { error } = await supabase
      .from("requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      console.error("❌ Error rejecting request:", error);
      alert("❌ Failed to reject request: " + error.message);
      return;
    }

    alert("❌ Request rejected.");
    loadRequestSection();
  } catch (err) {
    console.error("❌ Unexpected error rejecting request:", err);
    alert("❌ Unexpected error occurred.");
  }
};


// === Fix form button default behavior ===
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button").forEach(btn => {
    btn.type = "button";
  });
});


// === Sidebar Navigation Logic ===
const contentArea = document.getElementById("dashboard-content");

const loadDashboard = async () => {
  const contentArea = document.getElementById("dashboard-content");
  contentArea.innerHTML = `
    <div class="dashboard-cards blood-stock" id="blood-stock-cards">Loading blood stock...</div>
    <div class="dashboard-cards summary" id="summary-cards"></div>
  `;

  const stockContainer = document.getElementById("blood-stock-cards");
  const summaryContainer = document.getElementById("summary-cards");

  // Fetch stock data
  const { data: stock, error: stockError } = await supabase.from("stock").select("*");
  const bloodGroups = ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"];

  if (stockError) {
    stockContainer.innerHTML = `<p>Error loading stock</p>`;
    return;
  }

  stockContainer.innerHTML = "";
  bloodGroups.forEach(group => {
    const found = stock?.find(item => item.blood_group === group);
    stockContainer.innerHTML += `
      <div class="card card-stock">
        <h3>${group} <i class="fas fa-tint red"></i></h3>
        <p>${found?.units ?? 0}</p>
      </div>
    `;
  });

  // Fetch Summary Stats
  const [{ count: donorsCount }, { count: requestCount }, { count: approvedCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "donor"),
    supabase.from("requests").select("id", { count: "exact", head: true }),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "approved")
  ]);

  const totalUnits = stock?.reduce((sum, s) => sum + (s.units || 0), 0) ?? 0;

  // Append Summary Cards
  summaryContainer.innerHTML = `
  <div class="card card-total">
    <h3>Total Donors <i class="fas fa-users blue"></i></h3>
    <p>${donorsCount ?? 0}</p>
  </div>
  <div class="card card-pending">
    <h3>Total Requests <i class="fas fa-spinner blue"></i></h3>
    <p>${requestCount ?? 0}</p>
  </div>
  <div class="card card-approved">
    <h3>Approved Requests <i class="fas fa-check-circle blue"></i></h3>
    <p>${approvedCount ?? 0}</p>
  </div>
  <div class="card card-rejected">
    <h3>Total Blood Unit (ml) <i class="fas fa-tint blue"></i></h3>
    <p>${totalUnits}</p>
  </div>
`;
};

loadDashboard();


// const loadDashboard = async () => {
//     const contentArea = document.getElementById("dashboard-content");
//     contentArea.innerHTML = `<div class="grid" id="dashboard-cards">Loading dashboard...</div>`;
  
//     const dashboardCards = document.getElementById("dashboard-cards");
  
//     // Fetch stock data
//     const { data: stock, error: stockError } = await supabase.from("stock").select("*");
//     const bloodGroups = ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"];
  
//     dashboardCards.innerHTML = ""; // Clear loading state
  
//     bloodGroups.forEach(group => {
//       const found = stock?.find(item => item.blood_group === group);
//       dashboardCards.innerHTML += `
//         <div class="card">${group} <i class="fas fa-tint red"></i><span>${found?.units || 0}</span></div>
//       `;
//     });
  
//     // Fetch Donor count
//     const { count: donorsCount } = await supabase
//       .from("profiles")
//       .select("id", { count: "exact", head: true })
//       .eq("role", "donor");
  
//     // Total Requests
//     const { count: requestCount } = await supabase
//       .from("requests")
//       .select("id", { count: "exact", head: true });
  
//     // Approved Requests
//     const { count: approvedCount } = await supabase
//       .from("requests")
//       .select("id", { count: "exact", head: true })
//       .eq("status", "approved");
  
//     // Total Units
//     const totalUnits = stock?.reduce((sum, s) => sum + (s.units || 0), 0);
  
//     // Append summary cards
//     dashboardCards.innerHTML += `
//       <div class="card wide"><i class="fas fa-users blue"></i> Total Donors: <span>${donorsCount ?? 0}</span></div>
//       <div class="card wide"><i class="fas fa-sync blue"></i> Total Requests: <span>${requestCount ?? 0}</span></div>
//       <div class="card wide"><i class="fas fa-check-circle blue"></i> Approved Requests: <span>${approvedCount ?? 0}</span></div>
//       <div class="card wide"><i class="fas fa-tint blue"></i> Total Blood Unit (ml): <span>${totalUnits ?? 0}</span></div>
//     `;
//   };
  

const loadDonorSection = async () => {
    contentArea.innerHTML = `
      <h2>Registered Donors</h2>
      <table class="styled-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Blood Group</th>
            <th>City</th>
            <th>Last Donation</th>
            <th>Disease</th>
            <th>Age</th>
            <th>Gender</th>
          </tr>
        </thead>
        <tbody id="donor-table-body">
          <tr><td colspan="8">Loading donors...</td></tr>
        </tbody>
      </table>
    `;
  
    const { data: donors, error } = await supabase
      .from("profiles")
      .select("name, email, blood_group, city, last_donation, disease, age, gender")
      .eq("role", "donor");
  
    const tableBody = document.getElementById("donor-table-body");
  
    if (error || !donors) {
      tableBody.innerHTML = `<tr><td colspan="8">Error loading donors.</td></tr>`;
      return;
    }
  
    if (donors.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8">No donors found.</td></tr>`;
      return;
    }
  
    tableBody.innerHTML = "";
  
    donors.forEach((d) => {
      tableBody.innerHTML += `
        <tr>
          <td>${d.name}</td>
          <td>${d.email}</td>
          <td>${d.blood_group || "-"}</td>
          <td>${d.city || "-"}</td>
          <td>${d.last_donation || "-"}</td>
          <td>${d.disease || "-"}</td>
          <td>${d.age || "-"}</td>
          <td>${d.gender || "-"}</td>
        </tr>
      `;
    });
};
  
  

const loadPatientSection = async () => {
  contentArea.innerHTML = `
    <h2>Patients</h2>
    <table class="styled-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Age</th>
          <th>Gender</th>
          <th>Blood Group</th>
          <th>City</th>
        </tr>
      </thead>
      <tbody id="patient-table-body">
        <tr><td colspan="6">Loading patients...</td></tr>
      </tbody>
    </table>
  `;

  const { data: patients, error } = await supabase
    .from("profiles")
    .select("name, email, age, gender, blood_group, city")
    .eq("register_as", "patient"); // ✅ this is the correct field to filter

  const tableBody = document.getElementById("patient-table-body");

  if (error || !patients) {
    tableBody.innerHTML = `<tr><td colspan="6">Error loading patients.</td></tr>`;
    return;
  }

  if (patients.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">No patients found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  patients.forEach((p) => {
    tableBody.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${p.email}</td>
        <td>${p.age || "-"}</td>
        <td>${p.gender || "-"}</td>
        <td>${p.blood_group || "-"}</td>
        <td>${p.city || "-"}</td>
      </tr>
    `;
  });
};

  
  

// === Load Donation Section ===
const loadDonationSection = async () => {
  contentArea.innerHTML = `
    <h2>Donations</h2>
    <table class="styled-table">
      <thead>
        <tr>
          <th>Donor</th>
          <th>Blood Group</th>
          <th>Units</th>
          <th>Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="donation-table-body">
        <tr><td colspan="6">Loading donations...</td></tr>
      </tbody>
    </table>
  `;

  const { data: donations, error } = await supabase
    .from("donations")
    .select("*")
    .order("donation_date", { ascending: false });

  const tableBody = document.getElementById("donation-table-body");

  if (error || !donations) {
    tableBody.innerHTML = `<tr><td colspan="6">Error loading donations.</td></tr>`;
    return;
  }

  if (donations.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">No donations found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  for (const d of donations) {
    let donorName = "Unknown";

    if (d.donor_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", d.donor_id)
        .single();

      if (profile?.name) donorName = profile.name;
    }

    const isPending = d.status === "pending";

    tableBody.innerHTML += `
        <tr>
        <td>${donorName}</td>
        <td>${d.blood_group}</td>
        <td>${d.units}</td>
        <td>${d.donation_date}</td>
        <td>${d.status}</td>
        <td>
          ${isPending
            ? `
                <button type="button" class="btn-approve" onclick="handleDonation('${d.id}', '${d.blood_group}', ${d.units}, 'approved')">Approve</button>
                <button type="button" class="btn-reject" onclick="handleDonation('${d.id}', '${d.blood_group}', ${d.units}, 'rejected')">Reject</button>
              `
            : d.status === "approved"
              ? `<span class="status approved">✔ Approved</span>`
              : `<span class="status rejected">✘ Rejected</span>`
          }
        </td>
      </tr>
    `;

  }
};


const loadRequestSection = async () => {
  contentArea.innerHTML = `
    <h2>Blood Requests</h2>
    <table class="styled-table">
      <thead>
        <tr>
          <th>Patient</th>
          <th>Age</th>
          <th>Reason</th>
          <th>Blood Group</th>
          <th>Units</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="request-table-body">
        <tr><td colspan="7">Loading...</td></tr>
      </tbody>
    </table>
  `;

  const { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .eq("status", "pending");

  console.log("Requests Data:", requests);
  console.log("Error:", error);

  const table = document.getElementById("request-table-body");

  if (error || !requests || requests.length === 0) {
    table.innerHTML = `<tr><td colspan="7">No pending requests.</td></tr>`;
    return;
  }

  table.innerHTML = "";

  // 💡 manually get patient names using profile_id
  for (const r of requests) {
    let name = "Unknown";

    if (r.profile_id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", r.profile_id)
        .single();


      if (profile && profile.name) name = profile.name;
    }

    table.innerHTML += `
      <tr>
        <td>${name}</td>
        <td>${r.age || "-"}</td>
        <td>${r.reason}</td>
        <td>${r.blood_group}</td>
        <td>${r.unit}</td>
        <td>${r.status}</td>
        <td>
          <button onclick="approveRequest('${r.id}', '${r.blood_group}', ${r.unit})" class="btn-ptn">Approve</button>
          <button onclick="rejectRequest('${r.id}')" class="btn-ptn2">Reject</button>
        </td>
      </tr>
    `;
  }
};

  

  
  window.rejectRequest = async (id) => {
    await supabase
      .from("requests")
      .update({ status: "rejected" })
      .eq("id", id);
  
    loadRequestSection();
  };
  
  

  const loadHistorySection = async () => {
    contentArea.innerHTML = `
      <h2>Request History</h2>
      <table class="styled-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Age</th>
            <th>Reason</th>
            <th>Blood Group</th>
            <th>Unit (ml)</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody id="history-table-body">
          <tr><td colspan="7">Loading...</td></tr>
        </tbody>
      </table>
    `;
  
    const { data: history, error } = await supabase
      .from("requests")
      .select("*")
      .in("status", ["approved", "rejected"])
      .order("created_at", { ascending: false });
  
    const tableBody = document.getElementById("history-table-body");
  
    if (error || !history || history.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7">No past requests found.</td></tr>`;
      return;
    }
  
    tableBody.innerHTML = "";
  
    for (const r of history) {
      let name = "Unknown";
      if (r.profile_id) {
        const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", r.profile_id)
        .single();
      
        if (profile?.name) name = profile.name;
      }
  
      tableBody.innerHTML += `
        <tr>
          <td>${name}</td>
          <td>${r.age || "-"}</td>
          <td>${r.reason || "-"}</td>
          <td>${r.blood_group}</td>
          <td>${r.unit}</td>
          <td>${r.status}</td>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
        </tr>
      `;
    }
  };
  
  

  const loadStockSection = async () => {
    contentArea.innerHTML = `
      <h2>Blood Stock</h2>
      <table class="styled-table">
        <thead>
          <tr>
            <th>Blood Group</th>
            <th>Available Units</th>
          </tr>
        </thead>
        <tbody id="stock-table-body">
          <tr><td colspan="2">Loading...</td></tr>
        </tbody>
      </table>
    `;
  
    const { data: stock, error } = await supabase
      .from("stock")
      .select("*")
      .order("blood_group", { ascending: true });
  
    const tableBody = document.getElementById("stock-table-body");
  
    if (error || !stock) {
      tableBody.innerHTML = `<tr><td colspan="2">Error loading stock.</td></tr>`;
      return;
    }
  
    if (stock.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="2">No blood stock data found.</td></tr>`;
      return;
    }
  
    tableBody.innerHTML = "";
  
    stock.forEach((item) => {
      tableBody.innerHTML += `
        <tr>
          <td>${item.blood_group}</td>
          <td>${item.units}</td>
        </tr>
      `;
    });
  };
  

// === Event Listeners for Sidebar Buttons ===
document.getElementById("dashboardBtn").onclick = loadDashboard;
document.getElementById("donorBtn").onclick = loadDonorSection;
document.getElementById("patientBtn").onclick = loadPatientSection;
document.getElementById("donationBtn").onclick = loadDonationSection;
document.getElementById("requestsBtn").onclick = loadRequestSection;
document.getElementById("historyBtn").onclick = loadHistorySection;
document.getElementById("stockBtn").onclick = loadStockSection;

// Auto-load the dashboard on initial page load
window.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
  });

//-----UpdateLogic-------
window.updateDonationStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from("donations")
      .update({ status: newStatus })
      .eq("id", id);
  
    if (!error) {
      loadDonationSection(); // Refresh list
    } else {
      alert("Failed to update donation status.");
    }
};

//status update function for requests

window.updateRequestStatus = async (id, newStatus) => {
  const { error } = await supabase
    .from("requests")
    .update({ status: newStatus })
    .eq("id", id);

  if (!error) {
    loadRequestSection(); // Refresh list
  } else {
    alert("Failed to update request status.");
  }
};

window.handleDonation = async (donationId, bloodGroup, units, decision) => {
  try {
    // 1. Update donation status
    const { error: updateErr } = await supabase
      .from("donations")
      .update({ status: decision })
      .eq("id", donationId);

    if (updateErr) {
      console.error("❌ Error updating donation status:", updateErr);
      return alert("❌ Failed to update donation status.");
    }

    // 2. If approved, increment stock
    if (decision === "approved") {
      const { data, error: rpcError } = await supabase.rpc("increment_stock", {
        blood_group_input: bloodGroup.trim(),
        added_units: parseInt(units),
      });

      if (rpcError) {
        console.error("❌ Stock increment RPC failed:", rpcError);
        return alert("❌ Failed to increment stock: " + rpcError.message);
      }

      console.log("✅ Stock incremented for:", bloodGroup);
    }

    alert(`✅ Donation ${decision}`);
    
    // ✅ Refresh the donation section so buttons are updated
    await loadDonationSection();

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    alert("❌ Something went wrong.");
  }
};

