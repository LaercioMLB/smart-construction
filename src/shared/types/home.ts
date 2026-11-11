export interface HomePublishedValues {
  professionals: number;
  professionalsDisplay: string;
  projects: number;
  projectsDisplay: string;
  rating: number;
  satisfaction: number;
  servicesLinkLabel: string;
  professionalSection: {
    description: string;
    availability: string;
  };
  reasons: { icon: string; text: string }[];
  portfolio: {
    ratingLabel: string;
    projectsLabel: string;
  };
}
