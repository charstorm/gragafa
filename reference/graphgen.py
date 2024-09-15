from dataclasses import dataclass, field

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.patches import Rectangle
from matplotlib.artist import Artist
from matplotlib.lines import Line2D

EPS = 1e-5


@dataclass
class Vec2D:
    """Represents a 2D vector or point."""

    x: float = 0.0
    y: float = 0.0

    def as_tuple(self) -> tuple[float, float]:
        return (self.x, self.y)

    def copy(self) -> "Vec2D":
        return Vec2D(self.x, self.y)

    def add(self, other: "Vec2D") -> "Vec2D":
        self.x += other.x
        self.y += other.y
        return self

    def scale(self, alpha: float) -> "Vec2D":
        self.x *= alpha
        self.y *= alpha
        return self

    def l2norm(self) -> float:
        result: float = (self.x * self.x + self.y * self.y) ** 0.5
        return result

    @staticmethod
    def random() -> "Vec2D":
        x, y = np.random.rand(2)
        return Vec2D(x, y)


@dataclass
class RectBox:
    """Specification for a rectangle."""

    position: Vec2D
    velocity: Vec2D
    acceleration: Vec2D
    shape: Vec2D
    force: Vec2D = field(default_factory=Vec2D)

    def get_center(self) -> Vec2D:
        """Returns the center coordinates of the rectangle."""
        center_x = self.position.x + self.shape.x / 2
        center_y = self.position.y + self.shape.y / 2
        return Vec2D(center_x, center_y)

    def is_overlapping(self, other: "RectBox") -> bool:
        # Check for overlap
        is_overlapping = not (
            self.position.x + self.shape.x < other.position.x
            or self.position.x > other.position.x + other.shape.x
            or self.position.y + self.shape.y < other.position.y
            or self.position.y > other.position.y + other.shape.y
        )
        return is_overlapping


@dataclass
class Node:
    """Represents the node of a graph"""

    node_id: int
    related_to: list[int]


Graph = list[Node]
Connections = list[tuple[int, int]]


def extract_connections(graph: Graph) -> Connections:
    unique_connections: set[tuple[int, int]] = set()
    for node_id, node in enumerate(graph):
        if node.node_id != node_id:
            raise ValueError(f"Node idx={node_id} is not matching with node's id")
        for relative in node.related_to:
            smaller = min(node_id, relative)
            bigger = max(node_id, relative)
            unique_connections.add((smaller, bigger))
            if bigger >= len(graph):
                raise ValueError(f"node_id {bigger} has no Node defined")
    return sorted(list(unique_connections))


def create_test_graph() -> Graph:
    return [
        Node(0, [1]),
        Node(1, [2, 9]),
        Node(2, [3]),
        Node(3, [4]),
        Node(4, [8, 5]),
        Node(5, [6]),
        Node(6, [9]),
        Node(7, [8, 9, 10]),
        Node(8, []),
        Node(9, [10]),
        Node(10, []),
    ]


@dataclass
class Config:
    box_width: float = 2
    box_height: float = 1
    attraction_coef: float = 1
    repulsion_coef: float = 130
    overlap_scale: float = 2
    slowing_coef: float = 0.2
    box_color: str = "blue"
    canvas_size: float = 15
    time_step: float = 0.1
    mass: float = 1


def get_starting_positions(separation: float, num_nodes: int) -> list[Vec2D]:
    angles = np.arange(num_nodes) * (2 * np.pi / num_nodes)
    result = []
    for angle in angles:
        position = Vec2D(x=separation * np.cos(angle), y=separation * np.sin(angle))
        result.append(position)
    np.random.shuffle(result)  # type: ignore
    return result


class GraphAnimation:
    def __init__(self, config: Config, graph: Graph, connections: Connections) -> None:
        self.config = config
        self.graph = graph
        self.connections = connections
        max_width = max(config.box_width, config.box_height)
        separation = 2 * len(graph) * max_width / (2 * np.pi)
        self.node_boxes = self.create_inital_rectangles(
            separation, len(graph), config.box_width, config.box_height
        )

        self.fig, self.ax = plt.subplots(figsize=(7, 7))

        self.lines: list[Line2D] = []

        for src_idx, dst_idx in self.connections:
            src_pos = self.node_boxes[src_idx].get_center()
            dst_pos = self.node_boxes[dst_idx].get_center()
            (line,) = self.ax.plot(
                [src_pos.x, dst_pos.x],
                [src_pos.y, dst_pos.y],
                "k-",
                lw=2,
            )
            self.lines.append(line)

        self.rect_patches: list[Rectangle] = []
        for rect in self.node_boxes:
            rect_patch = Rectangle(
                (rect.position.x, rect.position.y),
                rect.shape.x,
                rect.shape.y,
                angle=0,
                color=config.box_color,
                fill=True,
                zorder=2,
            )
            self.ax.add_patch(rect_patch)
            self.rect_patches.append(rect_patch)

        self.ax.set_xlim(-config.canvas_size, config.canvas_size)
        self.ax.set_ylim(-config.canvas_size, config.canvas_size)
        self.ax.set_aspect("equal")
        plt.tight_layout()

    def create_inital_rectangles(
        self, separation: float, num_nodes: int, width: float, height: float
    ) -> list[RectBox]:
        positions = get_starting_positions(separation, num_nodes)
        rectangles: list[RectBox] = []
        for position in positions:
            position.x -= width / 2
            position.y -= height / 2
            rect = RectBox(
                position=position,
                velocity=Vec2D(),
                acceleration=Vec2D(),
                shape=Vec2D(x=width, y=height),
            )
            rectangles.append(rect)
        return rectangles

    def clear_force_all(self) -> None:
        for rect in self.node_boxes:
            rect.force = Vec2D()

    def compute_repulsive_force(self, b1: RectBox, b2: RectBox) -> Vec2D:
        """
        Compute force on b1 due to b2.

        Force on b2 due to b1 is the exact opposite.
        """
        coef = self.config.repulsion_coef
        overlap_scale = self.config.overlap_scale

        p1 = b1.get_center().copy()
        p2 = b2.get_center().copy()

        diff = p1.add(p2.scale(-1))  # p1 - p2
        diff_norm = diff.l2norm()
        if diff_norm < EPS:
            diff_norm = EPS
        diff_unit = diff.scale(1 / diff_norm)

        force_magnitude = coef / (diff_norm**2)
        if b1.is_overlapping(b2):
            force_magnitude *= overlap_scale

        force_vec = diff_unit.scale(force_magnitude)
        return force_vec

    def compute_repulsive_all(self) -> None:
        """
        Every node repel every other node.
        Repulsion is increased if the nodes overlap.
        """
        for src_idx in range(len(self.graph)):
            for dst_idx in range(src_idx + 1, len(self.graph)):
                src_box = self.node_boxes[src_idx]
                dst_box = self.node_boxes[dst_idx]
                src_force = self.compute_repulsive_force(src_box, dst_box)
                dst_force = src_force.copy().scale(-1)
                src_box.force.add(src_force)
                dst_box.force.add(dst_force)

    def compute_attractive_force(self, b1: RectBox, b2: RectBox) -> Vec2D:
        if b1.is_overlapping(b2):
            return Vec2D()

        coef = self.config.attraction_coef

        p1 = b1.get_center().copy()
        p2 = b2.get_center().copy()

        diff = p1.add(p2.scale(-1))  # p1 - p2
        diff_norm = diff.l2norm()
        if diff_norm < EPS:
            diff_norm = EPS
        diff_unit = diff.scale(1 / diff_norm)

        force_magnitude = coef * diff_norm
        force_vec = diff_unit.scale(-force_magnitude)
        return force_vec

    def compute_attractive_all(self) -> None:
        # TODO: cleanup repeated code!
        for src_idx, dst_idx in self.connections:
            src_box = self.node_boxes[src_idx]
            dst_box = self.node_boxes[dst_idx]
            src_force = self.compute_attractive_force(src_box, dst_box)
            dst_force = src_force.copy().scale(-1)
            src_box.force.add(src_force)
            dst_box.force.add(dst_force)

    def compute_slowing_all(self) -> None:
        coef = self.config.slowing_coef
        for box in self.node_boxes:
            veclocity = box.velocity
            norm = veclocity.l2norm()
            if norm < EPS:
                norm = EPS
            veclocity_unit = veclocity.copy().scale(1 / norm)
            force_magnitude = coef * norm
            force_vec = veclocity_unit.scale(-force_magnitude)
            box.force.add(force_vec)

    def update_position_all(self) -> None:
        time_step = self.config.time_step
        mass = self.config.mass
        limit = self.config.canvas_size - 2
        for box in self.node_boxes:
            box.acceleration = box.force.scale(1 / mass)
            box.velocity.add(box.acceleration.copy().scale(time_step))
            box.position.add(box.velocity.copy().scale(time_step))
            box.position.x = max(-limit, min(limit, box.position.x))
            box.position.y = max(-limit, min(limit, box.position.y))

    def run_simulation(self) -> None:
        """Update node positions"""
        self.clear_force_all()
        self.compute_repulsive_all()
        self.compute_attractive_all()
        self.compute_slowing_all()
        self.update_position_all()

    def update_patches(self) -> None:
        for box, rect in zip(self.node_boxes, self.rect_patches):
            rect.set_xy((box.position.x, box.position.y))

        for conn, line in zip(self.connections, self.lines):
            src_idx, dst_idx = conn
            x1, y1 = self.node_boxes[src_idx].get_center().as_tuple()
            x2, y2 = self.node_boxes[dst_idx].get_center().as_tuple()
            line.set_data([x1, x2], [y1, y2])

    def animate(self, i: int) -> list[Artist]:
        self.run_simulation()
        self.update_patches()
        result: list[Artist] = [*self.rect_patches, *self.lines]
        return result

    def start_animation(self) -> None:
        _anim = animation.FuncAnimation(
            self.fig, self.animate, frames=1000000, interval=10
        )
        plt.show()


def main() -> None:
    np.random.seed(2)
    config = Config()
    graph = create_test_graph()
    connections = extract_connections(graph)
    graph_anim = GraphAnimation(config, graph, connections)
    graph_anim.start_animation()


if __name__ == "__main__":
    main()
