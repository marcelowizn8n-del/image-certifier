import { Card, CardContent } from "@/components/ui/card";
import { Quote, Star } from "lucide-react";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
}

const testimonials: Testimonial[] = [
  {
    quote: "Image Certifier has become an essential tool in our newsroom. We verify every image before publication to ensure our readers get authentic content.",
    name: "Sarah Chen",
    role: "Editor-in-Chief",
    company: "Digital News Network",
  },
  {
    quote: "As a forensic analyst, accuracy is everything. The 94.2% detection rate gives me confidence in my investigations.",
    name: "Dr. Michael Torres",
    role: "Digital Forensics Expert",
    company: "CyberSec Labs",
  },
  {
    quote: "We process thousands of user-submitted images daily. Image Certifier's batch analysis saves us hours of manual review.",
    name: "Emma Johnson",
    role: "Content Moderation Lead",
    company: "SocialHub Platform",
  },
  {
    quote: "The detailed analysis reports help us educate our students about AI-generated content and digital literacy.",
    name: "Prof. David Kim",
    role: "Media Studies Professor",
    company: "Stanford University",
  },
  {
    quote: "Before listing any property, we verify all photos are authentic. It builds trust with our clients and protects our reputation.",
    name: "Lisa Martinez",
    role: "Real Estate Broker",
    company: "Premier Properties",
  },
  {
    quote: "The API integration was seamless. Now our entire workflow automatically flags potentially AI-generated images.",
    name: "James Wilson",
    role: "CTO",
    company: "MediaVerify Inc.",
  },
];

export function Testimonials() {
  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4" data-testid="text-testimonials-title">
            Trusted by Professionals Worldwide
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See what our users say about Image Certifier
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur-sm"
              data-testid={`card-testimonial-${index}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                <div className="relative mb-6">
                  <Quote className="absolute -top-2 -left-2 h-8 w-8 text-primary/20" />
                  <p className="text-muted-foreground leading-relaxed pl-4">
                    "{testimonial.quote}"
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {testimonial.company}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
